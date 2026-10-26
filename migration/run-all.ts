// Runs the whole staging rehearsal in order and prints a timing table. Stops on the first failure.
//
//   tsx migration/run-all.ts            plan: dry-run of every step that changes something (no writes)
//   tsx migration/run-all.ts --apply    for each changing step: dry-run, then apply; then verify
//
// Order: migrate, verify-schema, load-data, import-users, upload-files, rewrite-urls, verify-files, smoke-test.
// rewrite-urls only changes data when you pass --rewrite-urls=bare|supabase (the Phase 1 server does not need it).
// Other flags: --skip-smoke, --skip-cron-run, --dump=<file>, --files-dir=<dir>.

import { finish, loadTargetEnv, log, parseArgs, runStep, writeReport, type StepContext, type StepReport, type StepResult } from "./lib";
import * as migrate from "./migrate";
import * as verifySchema from "./verify-schema";
import * as loadData from "./load-data";
import * as importUsers from "./import-users";
import * as uploadFiles from "./upload-files";
import * as rewriteUrls from "./rewrite-urls";
import * as verifyFiles from "./verify-files";
import * as smokeTest from "./smoke-test";

type StepDef = { name: string; run: (ctx: StepContext) => Promise<StepResult>; changes: boolean; needsApply?: boolean };

const STEPS: StepDef[] = [
  { name: "migrate", run: migrate.run, changes: true },
  { name: "verify-schema", run: verifySchema.run, changes: false, needsApply: true },
  { name: "load-data", run: loadData.run, changes: true },
  { name: "import-users", run: importUsers.run, changes: true },
  { name: "upload-files", run: uploadFiles.run, changes: true },
  { name: "rewrite-urls", run: rewriteUrls.run, changes: true },
  { name: "verify-files", run: verifyFiles.run, changes: false, needsApply: true },
  { name: "smoke-test", run: smokeTest.run, changes: false, needsApply: true },
];

type Row = { step: string; mode: string; seconds: number; status: string };

async function main() {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  const env = loadTargetEnv(args);
  const rewriteForm = args.values["rewrite-urls"];
  const rows: Row[] = [];
  const started = Date.now();
  let failedAt: string | null = null;

  const exec = async (def: StepDef, mode: StepReport["mode"], reportName: string, ctxApply: boolean, ctxArgs = args) => {
    const report = await runStep(reportName, mode, () => def.run({ env, args: ctxArgs, apply: ctxApply }));
    rows.push({ step: def.name, mode, seconds: Math.round(report.ms) / 1000, status: report.ok ? "ok" : "FAILED" });
    return report;
  };

  for (const def of STEPS) {
    if (def.name === "smoke-test" && args.flags.has("skip-smoke")) {
      rows.push({ step: def.name, mode: "-", seconds: 0, status: "skipped (--skip-smoke)" });
      continue;
    }
    if (def.needsApply && !apply) {
      rows.push({ step: def.name, mode: "-", seconds: 0, status: "skipped (plan mode)" });
      continue;
    }
    if (!def.changes) {
      const report = await exec(def, "read-only", def.name, false);
      if (!report.ok) {
        failedAt = def.name;
        break;
      }
      continue;
    }
    // Steps that change data: always a dry-run first.
    const stepApply = apply && (def.name !== "rewrite-urls" || !!rewriteForm);
    const stepArgs = def.name === "rewrite-urls" && rewriteForm ? { ...args, values: { ...args.values, form: rewriteForm } } : args;
    const dry = await exec(def, "dry-run", stepApply ? `${def.name}.dry-run` : def.name, false, stepArgs);
    if (!dry.ok) {
      failedAt = def.name;
      break;
    }
    if (stepApply) {
      const real = await exec(def, "apply", def.name, true, stepArgs);
      if (!real.ok) {
        failedAt = def.name;
        break;
      }
    }
  }

  const totalSeconds = Math.round(Date.now() - started) / 1000;
  console.log("\nstep".padEnd(18) + "mode".padEnd(11) + "seconds".padEnd(10) + "status");
  for (const row of rows) console.log(row.step.padEnd(17) + " " + row.mode.padEnd(10) + " " + String(row.seconds).padEnd(9) + " " + row.status);
  console.log(`total ${totalSeconds}s${failedAt ? `, stopped at ${failedAt}` : ""}\n`);

  const report: StepReport = {
    step: "run-all",
    mode: apply ? "apply" : "dry-run",
    ok: !failedAt,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
    ms: Date.now() - started,
    failedAt,
    rows,
  };
  writeReport("run-all", report);
  log("run-all", failedAt ? `stopped at ${failedAt}` : "all steps passed");
  finish(report);
}

main().catch(error => {
  console.error(`[run-all] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
