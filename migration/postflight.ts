// Cutover postflight: run after the API and the frontend are live. Targets .env.production.
//
//   tsx migration/postflight.ts                      safe checks only
//   tsx migration/postflight.ts --with-test-user     also sign in with a temporary test account (created, then removed)
//   tsx migration/postflight.ts --run-cron           also RUN the three scheduled jobs (they scrape sites and write data)
//
// Without those two flags nothing is created, changed or deleted in production. Checks:
//   API (API_URL, default https://api.justputzit.com): /health, public and protected tRPC, storage redirect,
//     every /api/scheduled/* route refuses a call without the secret (401; 503 means CRON_SECRET is not set there),
//     and the browser CORS preflight from the site origin.
//   Frontend (SITE_URL, default https://justputzit.com): the SPA, deep links, manifest, brand image,
//     robots.txt, sitemap.xml and the /manus-storage proxy rewrite.
//   Files: a random sample of 50 keys from phase0/manifest.csv resolves in Supabase Storage.
// Prints a pass/fail table; exit code 1 if anything failed.

import fs from "node:fs";
import path from "node:path";
import { ROOT, finish, isMain, loadProductionEnv, log, parseArgs, runStep, withRetry, type StepContext } from "./lib";
import { printTable } from "./preflight";
import { parseManifest } from "./sql";
import * as smokeTest from "./smoke-test";
import * as verifyFiles from "./verify-files";

type Row = { name: string; status: "PASS" | "FAIL"; detail: string };

export async function run(ctx: StepContext) {
  const { env } = ctx;
  const rows: Row[] = [];
  const add = (name: string, pass: boolean, detail: string) => rows.push({ name, status: pass ? "PASS" : "FAIL", detail });
  const get = (url: string, init: RequestInit = {}) => withRetry(() => fetch(url, { redirect: "manual", signal: AbortSignal.timeout(30_000), ...init }));
  const guard = async (name: string, fn: () => Promise<[boolean, string]>) => {
    try {
      const [pass, detail] = await fn();
      add(name, pass, detail);
    } catch (error) {
      add(name, false, (error as Error).message.slice(0, 100));
    }
  };

  // ── API: reuse the smoke test, without creating or running anything unless asked ──────────────
  const smokeArgs = { flags: new Set<string>(), values: ctx.args.values };
  if (!ctx.args.flags.has("run-cron")) smokeArgs.flags.add("skip-cron-run");
  if (!ctx.args.flags.has("with-test-user")) smokeArgs.flags.add("skip-test-user");
  log("postflight", `API smoke test against ${env.apiUrl} (cron run: ${ctx.args.flags.has("run-cron") ? "yes" : "no"}, test user: ${ctx.args.flags.has("with-test-user") ? "yes" : "no"})`);
  try {
    const smoke = await smokeTest.run({ env, args: smokeArgs, apply: false });
    for (const check of smoke.checks as Array<{ name: string; pass: boolean; detail: string }>) add(`API ${check.name}`, check.pass, check.detail);
  } catch (error) {
    add("API smoke test", false, (error as Error).message.slice(0, 100));
  }

  // ── API: CORS preflight as the browser would send it from the site ────────────────────────────
  await guard("API CORS preflight from the site origin", async () => {
    const res = await get(`${env.apiUrl}/api/trpc/auth.me`, {
      method: "OPTIONS",
      headers: { Origin: env.siteUrl, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    const allowHeaders = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    return [res.status === 204 && allowOrigin === env.siteUrl && allowHeaders.includes("authorization"), `HTTP ${res.status}, allow-origin ${allowOrigin === env.siteUrl ? "matches" : "does not match"}, authorization header ${allowHeaders.includes("authorization") ? "allowed" : "NOT allowed"}`];
  });

  // ── Frontend ───────────────────────────────────────────────────────────────────────────────
  const site = env.siteUrl;
  await guard("SITE home page is the app", async () => {
    const res = await get(`${site}/`);
    const html = await res.text();
    return [res.status === 200 && html.includes('id="root"'), `HTTP ${res.status}`];
  });
  for (const route of ["/login", "/forgot-password", "/events"]) {
    await guard(`SITE deep link ${route} serves the app`, async () => {
      const res = await get(`${site}${route}`);
      const html = await res.text();
      return [res.status === 200 && html.includes('id="root"'), `HTTP ${res.status}`];
    });
  }
  await guard("SITE manifest.json", async () => {
    const res = await get(`${site}/manifest.json`);
    const body = (await res.json().catch(() => null)) as { name?: string } | null;
    return [res.status === 200 && !!body?.name, `HTTP ${res.status}`];
  });
  await guard("SITE brand image", async () => {
    const res = await get(`${site}/brand/justputzit-logo-transparent_2e545ffa.png`, { method: "HEAD" });
    return [res.status === 200 && (res.headers.get("content-type") ?? "").startsWith("image/"), `HTTP ${res.status}`];
  });
  for (const route of ["/robots.txt", "/sitemap.xml"]) {
    await guard(`SITE ${route} (proxied to the API)`, async () => {
      const res = await get(`${site}${route}`);
      return [res.status === 200, `HTTP ${res.status}`];
    });
  }
  const manifest = parseManifest(fs.readFileSync(path.resolve(ROOT, ctx.args.values.manifest ?? "phase0/manifest.csv"), "utf8"));
  if (manifest[0]) {
    await guard("SITE /manus-storage proxy rewrite", async () => {
      const res = await get(`${site}/manus-storage/${manifest[0].key}`);
      return [[200, 301, 302, 307, 308].includes(res.status), `HTTP ${res.status}`];
    });
  }

  // ── Files: random sample of 50 keys ──────────────────────────────────────────────────────────
  await guard("FILES random sample of 50 keys resolves", async () => {
    const result = (await verifyFiles.run({ env, args: { flags: new Set(), values: { ...ctx.args.values, sample: "50" } }, apply: false })) as { ok: boolean; keys: number; resolved: number; keysInManifest: number };
    return [result.ok, `${result.resolved}/${result.keys} resolved (manifest has ${result.keysInManifest} keys)`];
  });

  const failed = rows.filter(r => r.status === "FAIL");
  printTable(rows);
  if (failed.length > 0) {
    console.log("##########################################################");
    console.log(`#  POSTFLIGHT: ${failed.length} of ${rows.length} checks FAILED. Do not announce the cutover; consider rollback.`);
    console.log("##########################################################\n");
  } else console.log(`Postflight passed: ${rows.length}/${rows.length} checks.\n`);
  return { ok: failed.length === 0, passed: rows.length - failed.length, total: rows.length, rows };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  runStep("postflight", args.flags.has("run-cron") || args.flags.has("with-test-user") ? "apply" : "read-only", async () => run({ env: loadProductionEnv(), args, apply: false })).then(finish);
}
