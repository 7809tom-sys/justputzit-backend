// Cutover preflight: run this before any step that writes to production. Read-only.
//
//   tsx migration/preflight.ts            (always targets .env.production)
//
// Checks: variable NAMES are present (values are never printed), CRON_SECRET is set and long enough,
// CORS_ORIGINS includes the final domain, passkey settings match the domain, TiDB and Supabase are reachable,
// both buckets exist with the right visibility, the JWKS endpoint answers, the Gemini and Maps keys are
// accepted, and the production database is EMPTY. Any failure ends with a loud banner and exit code 1.

import {
  finish,
  isMain,
  PRODUCTION_OPTIONAL,
  PRODUCTION_REQUIRED,
  connectDb,
  dbName,
  listTables,
  loadProductionEnv,
  readProductionFile,
  redact,
  runStep,
  supabaseAdmin,
  withRetry,
  type StepContext,
} from "./lib";

type Status = "PASS" | "FAIL" | "WARN";
type Check = { name: string; status: Status; detail: string };

const FINAL_DOMAIN = (process.env.FINAL_DOMAIN ?? "https://justputzit.com").replace(/\/+$/, "");
const MIN_CRON_SECRET_LENGTH = 32;

export function printTable(rows: Array<{ name: string; status: string; detail: string }>) {
  const width = Math.min(60, Math.max(...rows.map(r => r.name.length)) + 2);
  console.log("");
  for (const row of rows) console.log(`${row.status.padEnd(5)} ${row.name.padEnd(width)} ${row.detail}`);
  console.log("");
}

export async function run(_ctx?: Partial<StepContext>) {
  const checks: Check[] = [];
  const add = (name: string, status: Status, detail: string) => checks.push({ name, status, detail });
  const attempt = async (name: string, fn: () => Promise<[Status, string]>) => {
    try {
      const [status, detail] = await fn();
      add(name, status, detail);
    } catch (error) {
      add(name, "FAIL", redact(error instanceof Error ? error.message : String(error)).slice(0, 160));
    }
  };

  // 1. the env file and the guards (not staging, not the Manus database)
  let env: ReturnType<typeof loadProductionEnv> | null = null;
  let file: Record<string, string> = {};
  try {
    file = readProductionFile();
    env = loadProductionEnv();
    add(".env.production loads and passes the guards", "PASS", "target=production; not the staging or Manus database");
  } catch (error) {
    add(".env.production loads and passes the guards", "FAIL", redact((error as Error).message));
  }

  // 2. variable names
  const missing = PRODUCTION_REQUIRED.filter(name => !file[name]);
  add("required variables present", missing.length === 0 ? "PASS" : "FAIL", missing.length === 0 ? `${PRODUCTION_REQUIRED.length} of ${PRODUCTION_REQUIRED.length}` : `missing: ${missing.join(", ")}`);
  const missingOptional = PRODUCTION_OPTIONAL.filter(name => !file[name]);
  add("optional variables present", missingOptional.length === 0 ? "PASS" : "WARN", missingOptional.length === 0 ? "all set" : `not set: ${missingOptional.join(", ")}`);

  // 3. CRON_SECRET
  const cron = file.CRON_SECRET ?? "";
  add("CRON_SECRET is set and long enough", cron.length >= MIN_CRON_SECRET_LENGTH ? "PASS" : "FAIL", cron ? `${cron.length} characters (minimum ${MIN_CRON_SECRET_LENGTH})` : "not set");

  // 4. CORS and domain consistency
  const origins = (file.CORS_ORIGINS ?? "").split(",").map(o => o.trim().replace(/\/+$/, "")).filter(Boolean);
  add(`CORS_ORIGINS includes ${FINAL_DOMAIN}`, origins.includes(FINAL_DOMAIN) ? "PASS" : "FAIL", `${origins.length} origins listed`);
  const www = FINAL_DOMAIN.replace("https://", "https://www.");
  add(`CORS_ORIGINS includes ${www}`, origins.includes(www) ? "PASS" : "WARN", "needed only if members use the www address");
  const host = new URL(FINAL_DOMAIN).hostname;
  add("WEBAUTHN_RP_ID is the final domain", file.WEBAUTHN_RP_ID === host ? "PASS" : "FAIL", file.WEBAUTHN_RP_ID === host ? host : "passkeys registered on the old domain will not work");
  add("WEBAUTHN_ORIGIN is the final origin", file.WEBAUTHN_ORIGIN?.replace(/\/+$/, "") === FINAL_DOMAIN ? "PASS" : "FAIL", FINAL_DOMAIN);
  add("VITE_SITE_URL is the final origin", file.VITE_SITE_URL?.replace(/\/+$/, "") === FINAL_DOMAIN ? "PASS" : "FAIL", FINAL_DOMAIN);
  add("VITE_SUPABASE_URL matches SUPABASE_URL", file.VITE_SUPABASE_URL?.replace(/\/+$/, "") === file.SUPABASE_URL?.replace(/\/+$/, "") ? "PASS" : "FAIL", "frontend and API use the same project");
  add("API URL is what the frontend will call", (file.API_URL || "https://api.justputzit.com").replace(/\/+$/, "") === (file.VITE_API_URL ?? "").replace(/\/+$/, "") ? "PASS" : "WARN", "VITE_API_URL vs API_URL (default https://api.justputzit.com)");
  const admins = (file.ADMIN_EMAILS ?? "").split(",").filter(e => e.trim()).length;
  add("ADMIN_EMAILS lists at least one admin", admins > 0 ? "PASS" : "FAIL", `${admins} address(es)`);
  add("Stripe key is a live key", file.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "PASS" : "WARN", file.STRIPE_SECRET_KEY?.startsWith("sk_live_") ? "live mode" : "not a live-mode key (fine only for a dry run)");
  add("Stripe webhook secret looks right", file.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ? "PASS" : "FAIL", "the secret of the PRODUCTION webhook endpoint (you register it in Stripe)");

  if (env) {
    const e = env;
    // 5. TiDB
    let dbReachable = false;
    await attempt("TiDB reachable", async () => {
      const db = await connectDb(e);
      try {
        await db.query("SELECT 1");
        const name = await dbName(db);
        dbReachable = true;
        return ["PASS", `database "${name}"`];
      } finally {
        await db.end();
      }
    });

    // 6. production database must be empty
    if (dbReachable) {
      await attempt("production database is empty", async () => {
        const db = await connectDb(e);
        try {
          const tables = (await listTables(db)).filter(t => !t.startsWith("__"));
          const withRows: Array<[string, number]> = [];
          for (const table of tables) {
            const [rows] = await db.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
            const n = Number((rows as Array<{ n: number | string }>)[0].n);
            if (n > 0) withRows.push([table, n]);
          }
          const total = withRows.reduce((sum, [, n]) => sum + n, 0);
          if (withRows.length > 0) return ["FAIL", `NOT EMPTY: ${withRows.length} tables hold ${total} rows (e.g. ${withRows.slice(0, 4).map(([t]) => t).join(", ")}); load-data will refuse`];
          return ["PASS", `${tables.length} tables, 0 rows`];
        } finally {
          await db.end();
        }
      });
    }

    // 7. Supabase
    const supabase = supabaseAdmin(e);
    await attempt("Supabase Auth reachable (admin API)", async () => {
      const { data, error } = await withRetry(() => supabase.auth.admin.listUsers({ page: 1, perPage: 1 }));
      if (error) return ["FAIL", error.message.slice(0, 100)];
      return ["PASS", "admin key accepted"];
    });
    await attempt("Supabase Auth has no members yet", async () => {
      const { data, error } = await withRetry(() => supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }));
      if (error) return ["FAIL", error.message.slice(0, 100)];
      return data.users.length === 0 ? ["PASS", "0 auth users"] : ["WARN", `${data.users.length} auth user(s) already exist (import-users reuses them, but check this is expected)`];
    });
    await attempt("JWKS endpoint answers", async () => {
      const res = await withRetry(() => fetch(file.SUPABASE_JWKS_URL ?? ""));
      const body = (await res.json().catch(() => ({}))) as { keys?: unknown[] };
      return res.status === 200 && Array.isArray(body.keys) && body.keys.length > 0 ? ["PASS", `${body.keys.length} signing key(s)`] : ["FAIL", `HTTP ${res.status}`];
    });
    await attempt(`bucket ${e.publicBucket} exists and is public`, async () => {
      const { data, error } = await withRetry(() => supabase.storage.getBucket(e.publicBucket));
      if (error || !data) return ["FAIL", "missing (create it as a public bucket)"];
      return data.public ? ["PASS", "public"] : ["FAIL", "exists but is private"];
    });
    await attempt(`bucket ${e.privateBucket} exists and is private`, async () => {
      const { data, error } = await withRetry(() => supabase.storage.getBucket(e.privateBucket));
      if (error || !data) return ["FAIL", "missing (create it as a private bucket)"];
      return data.public ? ["FAIL", "exists but is PUBLIC; member photos would be exposed"] : ["PASS", "private"];
    });

    // 8. third-party keys accepted
    await attempt("Gemini key accepted", async () => {
      const res = await withRetry(() => fetch("https://generativelanguage.googleapis.com/v1beta/openai/models", { headers: { authorization: `Bearer ${file.GEMINI_API_KEY ?? ""}` } }));
      return res.status === 200 ? ["PASS", "models endpoint HTTP 200"] : ["FAIL", `HTTP ${res.status}`];
    });
    await attempt("Google Maps server key accepted", async () => {
      const res = await withRetry(() => fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Milwaukee&key=${encodeURIComponent(file.GOOGLE_MAPS_SERVER_KEY ?? "")}`));
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      return body.status === "OK" ? ["PASS", "geocoding OK"] : ["FAIL", `geocoding status ${body.status ?? res.status}`];
    });
  }

  const failed = checks.filter(c => c.status === "FAIL");
  const warned = checks.filter(c => c.status === "WARN");
  printTable(checks);
  if (failed.length > 0) {
    console.log("##########################################################");
    console.log(`#  PREFLIGHT FAILED: ${failed.length} check(s) failed. DO NOT START THE CUTOVER.`);
    console.log("##########################################################\n");
  } else {
    console.log(`Preflight passed (${checks.length} checks, ${warned.length} warning(s)).\n`);
  }
  return { ok: failed.length === 0, passed: checks.filter(c => c.status === "PASS").length, warnings: warned.length, failed: failed.length, checks };
}

if (isMain(import.meta.url)) {
  runStep("preflight", "read-only", () => run()).then(finish);
}
