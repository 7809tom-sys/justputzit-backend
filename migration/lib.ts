// Shared plumbing for the staging rehearsal scripts.
// Rules: staging only, dry-run first, counts and IDs in logs (never emails, hashes or secrets).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "node:fs";
import mysql from "mysql2/promise";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPORT_DIR = path.join(ROOT, "migration", "reports");
let reportDir = REPORT_DIR;

export type Args = { flags: Set<string>; values: Record<string, string> };

export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [name, ...rest] = arg.slice(2).split("=");
    if (rest.length) values[name] = rest.join("=");
    else flags.add(name);
  }
  return { flags, values };
}

// ── staging environment + guards ─────────────────────────────────────────────

export type Target = "staging" | "production";

export type StagingEnv = {
  target: Target;
  /** Public URLs; only set for production runs (postflight checks them). */
  siteUrl: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  supabasePublishableKey: string;
  publicBucket: string;
  privateBucket: string;
  apiUrl: string;
  cronSecret: string;
};

const hostAndPath = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return url;
  }
};

/**
 * Loads ./.env.staging (never ./.env) and refuses to continue unless it is clearly a staging target
 * and does not point at the same database or Supabase project as ./.env.
 */
export function loadStagingEnv(): StagingEnv {
  const file = path.join(ROOT, ".env.staging");
  if (!fs.existsSync(file)) {
    throw new Error("Missing .env.staging. Copy .env.staging.example and fill in the STAGING values.");
  }
  const staging = dotenv.parse(fs.readFileSync(file));
  if (staging.MIGRATION_TARGET !== "staging") {
    throw new Error('Refusing to run: .env.staging must contain MIGRATION_TARGET=staging.');
  }

  const mainFile = path.join(ROOT, ".env");
  if (fs.existsSync(mainFile)) {
    const main = dotenv.parse(fs.readFileSync(mainFile));
    if (main.DATABASE_URL && staging.DATABASE_URL && hostAndPath(main.DATABASE_URL) === hostAndPath(staging.DATABASE_URL)) {
      throw new Error("Refusing to run: .env.staging DATABASE_URL is the same database as .env.");
    }
    if (main.SUPABASE_URL && staging.SUPABASE_URL && main.SUPABASE_URL.replace(/\/+$/, "") === staging.SUPABASE_URL.replace(/\/+$/, "")) {
      throw new Error("Refusing to run: .env.staging SUPABASE_URL is the same project as .env.");
    }
  }

  const need = (name: string) => {
    const value = staging[name];
    if (!value) throw new Error(`.env.staging is missing ${name}`);
    return value;
  };
  return {
    target: "staging",
    siteUrl: "",
    databaseUrl: need("DATABASE_URL"),
    supabaseUrl: need("SUPABASE_URL"),
    supabaseSecretKey: need("SUPABASE_SECRET_KEY"),
    supabasePublishableKey: staging.SUPABASE_PUBLISHABLE_KEY ?? "",
    publicBucket: staging.SUPABASE_PUBLIC_BUCKET || "site-public",
    privateBucket: staging.SUPABASE_PRIVATE_BUCKET || "member-private",
    apiUrl: (staging.STAGING_API_URL ?? "").replace(/\/+$/, ""),
    cronSecret: staging.CRON_SECRET ?? "",
  };
}

/** Host of the Manus database named in the export's header ("-- Host: ..."), so we can refuse to write to it. */
function manusSourceHost(): string | null {
  const dump = path.join(ROOT, "full-database-dump.sql");
  if (!fs.existsSync(dump)) return null;
  const head = fs.readFileSync(dump, "utf8").slice(0, 2000);
  return /^-- Host:\s*(\S+)/m.exec(head)?.[1] ?? null;
}

/** Production variables the API and the cutover scripts need, by name (values are never printed). */
export const PRODUCTION_REQUIRED = [
  "DATABASE_URL", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_JWKS_URL",
  "GEMINI_API_KEY", "GOOGLE_MAPS_SERVER_KEY", "CRON_SECRET", "ADMIN_EMAILS", "CORS_ORIGINS", "VITE_SITE_URL",
  "WEBAUTHN_RP_ID", "WEBAUTHN_ORIGIN", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "OUTREACH_FROM_EMAIL",
  "VITE_API_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_GOOGLE_MAPS_KEY",
] as const;
export const PRODUCTION_OPTIONAL = ["GEMINI_MODEL", "EVENTBRITE_API_KEY", "EVENTBRITE_TOKEN", "MEETUP_API_KEY", "CINCH_SEED_ID", "CINCH_CONNECT_KEY", "VITE_ANALYTICS_ENDPOINT", "VITE_ANALYTICS_WEBSITE_ID"] as const;

export function readProductionFile(): Record<string, string> {
  const file = path.join(ROOT, ".env.production");
  if (!fs.existsSync(file)) throw new Error("Missing .env.production (provided by the owner; never committed).");
  const prod = dotenv.parse(fs.readFileSync(file));
  if (prod.MIGRATION_TARGET !== "production") throw new Error("Refusing to run: .env.production must contain MIGRATION_TARGET=production.");
  return prod;
}

/**
 * Loads ./.env.production for the cutover scripts. Refuses if the database or Supabase project is the staging
 * one, or if the database is the Manus source named in the export's header. Never touches Manus.
 */
export function loadProductionEnv(): StagingEnv {
  reportDir = path.join(REPORT_DIR, "production");
  const prod = readProductionFile();
  const stagingFile = path.join(ROOT, ".env.staging");
  if (fs.existsSync(stagingFile)) {
    const staging = dotenv.parse(fs.readFileSync(stagingFile));
    if (staging.DATABASE_URL && prod.DATABASE_URL && hostAndPath(staging.DATABASE_URL) === hostAndPath(prod.DATABASE_URL)) throw new Error("Refusing to run: .env.production DATABASE_URL is the staging database.");
    if (staging.SUPABASE_URL && prod.SUPABASE_URL && staging.SUPABASE_URL.replace(/\/+$/, "") === prod.SUPABASE_URL.replace(/\/+$/, "")) throw new Error("Refusing to run: .env.production SUPABASE_URL is the staging project.");
  }
  const manusHost = manusSourceHost();
  if (manusHost && prod.DATABASE_URL) {
    let target = "";
    try { target = new URL(prod.DATABASE_URL).hostname; } catch { /* reported below by the connection */ }
    if (target && target === manusHost) throw new Error("Refusing to run: .env.production DATABASE_URL is the Manus source database.");
  }
  const need = (name: string) => {
    if (!prod[name]) throw new Error(`.env.production is missing ${name}`);
    return prod[name];
  };
  return {
    target: "production",
    siteUrl: (prod.SITE_URL || "https://justputzit.com").replace(/\/+$/, ""),
    databaseUrl: need("DATABASE_URL"),
    supabaseUrl: need("SUPABASE_URL"),
    supabaseSecretKey: need("SUPABASE_SECRET_KEY"),
    supabasePublishableKey: prod.SUPABASE_PUBLISHABLE_KEY ?? "",
    publicBucket: prod.SUPABASE_PUBLIC_BUCKET || "site-public",
    privateBucket: prod.SUPABASE_PRIVATE_BUCKET || "member-private",
    apiUrl: (prod.API_URL || "https://api.justputzit.com").replace(/\/+$/, ""),
    cronSecret: prod.CRON_SECRET ?? "",
  };
}

/** `--target=production` selects .env.production (reports go to migration/reports/production/); default is staging. */
export function loadTargetEnv(args: Args): StagingEnv {
  if (args.values.target === "production") {
    reportDir = path.join(REPORT_DIR, "production");
    return loadProductionEnv();
  }
  if (args.values.target && args.values.target !== "staging") throw new Error('--target must be "staging" or "production"');
  return loadStagingEnv();
}

// ── logging, reports, timing ─────────────────────────────────────────────────

export const log = (step: string, message: string) => console.log(`[${step}] ${message}`);

export type StepReport = {
  step: string;
  mode: "dry-run" | "apply" | "read-only";
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  ms: number;
  [key: string]: unknown;
};

export function writeReport(name: string, report: StepReport) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, `${name}.json`), JSON.stringify(report, null, 2));
}

export type StepResult = { ok: boolean; [key: string]: unknown };
export type StepContext = { env: StagingEnv; args: Args; apply: boolean };

/** Times a step, converts a throw into a failed report, and always writes migration/reports/<name>.json. */
export async function runStep(
  name: string,
  mode: StepReport["mode"],
  fn: () => Promise<StepResult>,
): Promise<StepReport> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  let result: StepResult;
  try {
    result = await fn();
  } catch (error) {
    result = { ok: false, error: redact(error instanceof Error ? error.message : String(error)) };
  }
  const finished = Date.now();
  const report: StepReport = { step: name, mode, startedAt, finishedAt: new Date(finished).toISOString(), ms: finished - started, ...result };
  writeReport(name, report);
  log(name, `${report.ok ? "OK" : "FAILED"} in ${(report.ms / 1000).toFixed(1)}s (${mode})`);
  if (!report.ok && report.error) log(name, `error: ${report.error}`);
  return report;
}

/** Scrubs anything that looks like a credential or connection string from a message. */
export function redact(message: string): string {
  return message
    .replace(/(mysql|postgres(?:ql)?|https?):\/\/[^\s'"]+/gi, "<url>")
    .replace(/\b(sb_secret_|sb_publishable_|eyJ)[A-Za-z0-9._-]+/g, "<key>")
    .replace(/\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{20,}/g, "<hash>");
}

// ── connections ──────────────────────────────────────────────────────────────

export async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/** The staging databases sit behind a connection that drops now and then; retry transient failures. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5, baseMs = 1500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const code = (error as { code?: string }).code ?? "";
      const transient = /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|PROTOCOL_CONNECTION_LOST|fetch failed/i.test(`${code} ${error instanceof Error ? error.message : ""}`);
      if (!transient || i === attempts - 1) throw error;
      await sleep(baseMs * (i + 1));
    }
  }
  throw last;
}

export async function connectDb(env: StagingEnv, options: { multipleStatements?: boolean } = {}) {
  return withRetry(() => mysql.createConnection({ uri: env.databaseUrl, multipleStatements: options.multipleStatements ?? false }));
}
export type Db = Awaited<ReturnType<typeof connectDb>>;

export function supabaseAdmin(env: StagingEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const dbName = async (db: Db) => {
  const [rows] = await db.query("SELECT DATABASE() AS name");
  return String((rows as Array<{ name: string }>)[0]?.name ?? "");
};

export async function listTables(db: Db): Promise<string[]> {
  const [rows] = await db.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  return (rows as Array<Record<string, string>>).map(r => r.t ?? r.T ?? r.TABLE_NAME);
}

// ── entry point helper ───────────────────────────────────────────────────────

/** True when this file is the script being run (not imported by run-all or a test). */
export const isMain = (metaUrl: string) => !!process.argv[1] && metaUrl === pathToFileURL(process.argv[1]).href;

export function finish(report: StepReport) {
  process.exitCode = report.ok ? 0 : 1;
}

export function readText(relativePath: string) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}
