// Read-only: how much member activity has been written to PRODUCTION since a point in time.
// Used to decide on a rollback ("how much would we lose?"). Counts only; no row contents are read.
//
//   tsx migration/delta-report.ts --target=production --since=2026-11-02T14:00:00Z
//
// For every table with a createdAt column: rows created at or after --since. For users: also sign-ins
// (lastSignedIn) since then. Tables that are seed or crawler output (events, venues) are listed separately.

import { connectDb, finish, isMain, loadTargetEnv, log, parseArgs, runStep, type StepContext } from "./lib";

// Filled by crawlers and cron jobs, not by members; they would be re-crawled after a rollback.
const SYSTEM_TABLES = new Set(["community_events", "activity_listings", "venue_partners", "city_activity_refreshes", "city_event_sources", "event_source_health", "seeded_cities"]);

export async function run(ctx: StepContext) {
  const sinceRaw = ctx.args.values.since;
  const since = sinceRaw ? new Date(sinceRaw) : null;
  if (!since || Number.isNaN(since.getTime())) throw new Error("--since=<ISO time> is required, e.g. --since=2026-11-02T14:00:00Z");
  const stamp = since.toISOString().slice(0, 19).replace("T", " ");

  const db = await connectDb(ctx.env);
  try {
    await db.query("SET time_zone = '+00:00'");
    const [cols] = await db.query("SELECT table_name AS t FROM information_schema.columns WHERE table_schema = DATABASE() AND column_name = 'createdAt'");
    const tables = (cols as Array<Record<string, string>>).map(r => r.t ?? r.TABLE_NAME);
    const member: Record<string, number> = {};
    const system: Record<string, number> = {};
    for (const table of tables) {
      const [rows] = await db.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE createdAt >= ?`, [stamp]);
      const n = Number((rows as Array<{ n: number | string }>)[0].n);
      if (n > 0) (SYSTEM_TABLES.has(table) ? system : member)[table] = n;
    }
    const [signIns] = await db.query("SELECT COUNT(*) AS n FROM users WHERE lastSignedIn >= ?", [stamp]);
    const memberRows = Object.values(member).reduce((a, b) => a + b, 0);
    log("delta-report", `since ${since.toISOString()}: ${memberRows} member rows in ${Object.keys(member).length} tables, ${Number((signIns as Array<{ n: number | string }>)[0].n)} members signed in`);
    return { ok: true, since: since.toISOString(), memberRows, memberTables: member, systemTables: system, membersSignedIn: Number((signIns as Array<{ n: number | string }>)[0].n) };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  runStep("delta-report", "read-only", async () => run({ env: loadTargetEnv(args), args, apply: false })).then(finish);
}
