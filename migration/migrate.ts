// Step 0: build the staging schema.
//
//  A. Baseline from the export: any table in the Phase 0 export (default full-database-dump.sql) that is
//     missing is created from the export's own DDL. That is the live Manus schema. This is needed because
//     the migration files do NOT describe it: they create 71 tables, the live database has 113, and 43 of
//     those (voice_messages, gyms, game_questions, seeded_cities, ...) are created by no migration at all.
//  B. Numbered migrations: drizzle/*.sql applied on top, in filename order. "Already exists" errors are
//     tolerated, so migrations the live schema already contains are no-ops, and newer ones
//     (game_chat_messages_v2, users.legacyOpenId) are applied.
//
// Why not `drizzle-kit migrate`: drizzle/meta/_journal.json only lists migrations 0000-0022, but the folder
// holds 0000-0063, so it would silently skip 40 files. Applied files are tracked in __migration_rehearsal,
// and the JSON column defaults that TiDB rejects are rewritten. Safe to re-run.
// --no-baseline skips part A. --dump=<file> picks the export.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, connectDb, dbName, finish, isMain, listTables, loadTargetEnv, log, parseArgs, runStep, type StepContext } from "./lib";
import { parseDump, rewriteJsonDefaults, splitMigration } from "./sql";

const TRACKING_TABLE = "__migration_rehearsal";
// MySQL/TiDB codes meaning the change is already in place.
const ALREADY_APPLIED = new Set(["ER_TABLE_EXISTS_ERROR", "ER_DUP_FIELDNAME", "ER_DUP_KEYNAME", "ER_MULTIPLE_PRI_KEY", "ER_FK_DUP_NAME", "ER_CANT_DROP_FIELD_OR_KEY"]);

export async function run(ctx: StepContext) {
  const dir = path.join(ROOT, "drizzle");
  const files = fs.readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort();
  // Some files (e.g. 0029) hold several statements with no statement-breakpoint between them.
  const db = await connectDb(ctx.env, { multipleStatements: true });
  try {
    const name = await dbName(db);
    // A dry-run must not write anything, so the tracking table is only created when applying.
    const trackingExists = (await listTables(db)).includes(TRACKING_TABLE);
    if (ctx.apply && !trackingExists) {
      await db.query(`CREATE TABLE \`${TRACKING_TABLE}\` (name varchar(255) PRIMARY KEY, sha256 char(64) NOT NULL, applied_at timestamp DEFAULT CURRENT_TIMESTAMP)`);
    }
    const [applied] = ctx.apply || trackingExists ? await db.query(`SELECT name FROM \`${TRACKING_TABLE}\``) : [[]];
    const done = new Set((applied as Array<{ name: string }>).map(r => r.name));

    const result = { database: name, files: files.length, alreadyApplied: 0, applied: 0, statements: 0, tolerated: 0, wouldApply: 0, baselineCreated: [] as string[], baselineWouldCreate: 0 };

    // A. baseline from the export's DDL
    const dumpPath = path.resolve(ROOT, ctx.args.values.dump ?? "full-database-dump.sql");
    if (!ctx.args.flags.has("no-baseline") && fs.existsSync(dumpPath)) {
      const existing = new Set(await listTables(db));
      for (const table of parseDump(fs.readFileSync(dumpPath, "utf8")).values()) {
        if (table.name === "__drizzle_migrations" || existing.has(table.name)) continue;
        if (ctx.apply) {
          await db.query(table.ddl);
          result.baselineCreated.push(table.name);
        } else result.baselineWouldCreate++;
      }
    }

    // B. numbered migrations
    for (const file of files) {
      if (done.has(file)) {
        result.alreadyApplied++;
        continue;
      }
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      if (!ctx.apply) {
        result.wouldApply++;
        continue;
      }
      for (const statement of splitMigration(rewriteJsonDefaults(raw))) {
        try {
          await db.query(statement);
          result.statements++;
        } catch (error) {
          const code = (error as { code?: string }).code ?? "";
          if (!ALREADY_APPLIED.has(code)) throw new Error(`${file}: ${code || "error"} (${(error as Error).message.slice(0, 160)})`);
          result.tolerated++;
        }
      }
      await db.query(`INSERT INTO \`${TRACKING_TABLE}\` (name, sha256) VALUES (?, ?)`, [file, crypto.createHash("sha256").update(raw).digest("hex")]);
      result.applied++;
    }
    log("migrate", `baseline: ${result.baselineCreated.length} tables created from the export (${result.baselineWouldCreate} would). migrations: ${result.applied} applied, ${result.alreadyApplied} already applied, ${result.wouldApply} would apply, ${result.tolerated} tolerated "already exists"`);
    return { ok: true, ...result };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  runStep("migrate", apply ? "apply" : "dry-run", async () => run({ env: loadTargetEnv(args), args, apply })).then(finish);
}
