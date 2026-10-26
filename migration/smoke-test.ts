// Step 7: HTTP smoke test of the deployed STAGING API (STAGING_API_URL in .env.staging).
//
//   /health, a public tRPC procedure, a protected one with and without a test user's JWT,
//   the storage redirect, and every /api/scheduled/* route with and without CRON_SECRET.
//
// The test user is created in staging Supabase and removed again (auth user, users row, profile row).
// --skip-cron-run keeps the cron checks to "refused without the secret" and does not run the jobs
// (the jobs scrape external sites and write to the staging database, and can take several minutes).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { ROOT, connectDb, finish, isMain, loadTargetEnv, log, parseArgs, runStep, supabaseAdmin, withRetry, type StepContext } from "./lib";
import { parseManifest } from "./sql";

const CRON_ROUTES = ["/api/scheduled/scrape-events", "/api/scheduled/birthday-reminders", "/api/scheduled/refresh-events"];
type Check = { name: string; pass: boolean; detail: string };

export async function run(ctx: StepContext) {
  const { env } = ctx;
  if (!env.apiUrl) throw new Error("The API URL is missing from the env file (STAGING_API_URL / API_URL)");
  const api = env.apiUrl;
  const checks: Check[] = [];
  const record = (name: string, pass: boolean, detail: string) => {
    checks.push({ name, pass, detail });
    log("smoke-test", `${pass ? "PASS" : "FAIL"} ${name} (${detail})`);
  };
  const http = (url: string, init: RequestInit = {}) => withRetry(() => fetch(`${api}${url}`, { redirect: "manual", signal: AbortSignal.timeout(30_000), ...init }));

  // 1. health
  try {
    const res = await http("/health");
    const body = (await res.json().catch(() => ({}))) as { status?: string };
    record("GET /health", res.status === 200 && body.status === "ok", `HTTP ${res.status}`);
  } catch (error) {
    record("GET /health", false, (error as Error).message.slice(0, 80));
  }

  // 2. public tRPC procedure
  try {
    const res = await http(`/api/trpc/events.list?input=${encodeURIComponent(JSON.stringify({ json: { limit: 1 } }))}`);
    const body = (await res.json().catch(() => null)) as { result?: { data?: { json?: unknown } } } | null;
    record("public tRPC events.list", res.status === 200 && Array.isArray(body?.result?.data?.json), `HTTP ${res.status}`);
  } catch (error) {
    record("public tRPC events.list", false, (error as Error).message.slice(0, 80));
  }

  // 3. storage redirect for a real private key
  try {
    const manifest = parseManifest(fs.readFileSync(path.resolve(ROOT, ctx.args.values.manifest ?? "phase0/manifest.csv"), "utf8"));
    const key = manifest[0]?.key;
    if (key) {
      const res = await http(`/manus-storage/${key}`);
      record("storage redirect", res.status === 307, `HTTP ${res.status}`);
    }
  } catch (error) {
    record("storage redirect", false, (error as Error).message.slice(0, 80));
  }

  // 4. protected tRPC procedure: refused without a token, allowed with a test user's JWT
  const admin = supabaseAdmin(env);
  const db = await connectDb(env);
  let testUserId: string | null = null;
  try {
    try {
      const res = await http("/api/trpc/passkey.myPasskeys");
      record("protected tRPC without token is refused", res.status === 401, `HTTP ${res.status}`);
    } catch (error) {
      record("protected tRPC without token is refused", false, (error as Error).message.slice(0, 80));
    }

    if (ctx.args.flags.has("skip-test-user")) {
      log("smoke-test", "skipped the signed-in checks (--skip-test-user); no test account was created");
    } else if (!env.supabasePublishableKey) {
      record("protected tRPC with test user JWT", false, "SUPABASE_PUBLISHABLE_KEY missing from the env file");
    } else {
      const email = `smoke-${Date.now()}@example.com`;
      const password = `Smoke-${crypto.randomBytes(9).toString("hex")}!A1`;
      const { data: created, error: createError } = await withRetry(() => admin.auth.admin.createUser({ email, password, email_confirm: true }));
      if (createError || !created.user) record("create test user", false, createError?.message.slice(0, 80) ?? "no user");
      else {
        testUserId = created.user.id;
        const anon = createClient(env.supabaseUrl, env.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: session, error: signInError } = await withRetry(() => anon.auth.signInWithPassword({ email, password }));
        if (signInError || !session.session) record("test user sign-in", false, signInError?.message.slice(0, 80) ?? "no session");
        else {
          const auth = { Authorization: `Bearer ${session.session.access_token}` };
          const me = await http("/api/trpc/auth.me", { headers: auth });
          const meBody = (await me.json().catch(() => null)) as { result?: { data?: { json?: { id?: number } | null } } } | null;
          record("auth.me with JWT returns the user", me.status === 200 && !!meBody?.result?.data?.json?.id, `HTTP ${me.status}`);
          const prot = await http("/api/trpc/passkey.myPasskeys", { headers: auth });
          record("protected tRPC with test user JWT", prot.status === 200, `HTTP ${prot.status}`);
          const bad = await http("/api/trpc/passkey.myPasskeys", { headers: { Authorization: `Bearer ${session.session.access_token.slice(0, -3)}xyz` } });
          record("tampered JWT is refused", bad.status === 401, `HTTP ${bad.status}`);
        }
      }
    }
  } catch (error) {
    record("protected tRPC checks", false, (error as Error).message.slice(0, 80));
  } finally {
    if (testUserId) {
      await db.query("DELETE FROM user_profiles WHERE userId IN (SELECT id FROM users WHERE openId = ?)", [testUserId]).catch(() => undefined);
      await db.query("DELETE FROM users WHERE openId = ?", [testUserId]).catch(() => undefined);
      const { error } = await admin.auth.admin.deleteUser(testUserId);
      log("smoke-test", `test user removed: ${error ? "auth user NOT removed" : "yes"}`);
    }
    await db.end();
  }

  // 5. scheduled routes
  for (const route of CRON_ROUTES) {
    try {
      const refused = await http(route, { method: "POST" });
      record(`POST ${route} without secret is refused`, refused.status === 401, `HTTP ${refused.status}`);
    } catch (error) {
      record(`POST ${route} without secret is refused`, false, (error as Error).message.slice(0, 80));
    }
    if (ctx.args.flags.has("skip-cron-run")) continue;
    if (!env.cronSecret) {
      record(`POST ${route} with secret`, false, "CRON_SECRET missing from .env.staging");
      continue;
    }
    try {
      const res = await withRetry(() => fetch(`${api}${route}`, { method: "POST", headers: { Authorization: `Bearer ${env.cronSecret}` }, signal: AbortSignal.timeout(15 * 60_000) }), 1);
      record(`POST ${route} with secret`, res.status === 200, `HTTP ${res.status}`);
    } catch (error) {
      record(`POST ${route} with secret`, false, (error as Error).message.slice(0, 80));
    }
  }

  const failed = checks.filter(c => !c.pass);
  log("smoke-test", `${checks.length - failed.length}/${checks.length} checks passed`);
  return { ok: failed.length === 0, passed: checks.length - failed.length, total: checks.length, checks };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  runStep("smoke-test", args.flags.has("skip-cron-run") ? "read-only" : "apply", async () => run({ env: loadTargetEnv(args), args, apply: false })).then(finish);
}
