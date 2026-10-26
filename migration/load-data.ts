// Step 2: load the Phase 0 SQL export (a mysqldump with data) into staging and check row counts.
//
// - Only data is taken from the export. Tables are created by migrate.ts (baseline from the export's DDL,
//   then the numbered migrations). A table that is still missing is created from the export's DDL as a
//   safety net and reported.
// - INSERTs get the export's column list, so extra target columns (users.legacyOpenId) do not shift values.
// - Staging: idempotent. Each table is emptied (TRUNCATE) before it is loaded, so a re-run gives the same result.
// - Production (--target=production): never truncates. If any table that the export has data for already
//   has rows, nothing is written and the step fails; the cutover starts from an empty database.

import fs from "node:fs";
import path from "node:path";
import { ROOT, connectDb, dbName, finish, isMain, listTables, loadTargetEnv, log, parseArgs, runStep, withRetry, type StepContext } from "./lib";
import { parseDump, withColumnList } from "./sql";

const SKIP_TABLES = new Set(["__drizzle_migrations"]);

export async function run(ctx: StepContext) {
  const dumpPath = path.resolve(ROOT, ctx.args.values.dump ?? "full-database-dump.sql");
  if (!fs.existsSync(dumpPath)) throw new Error(`Export not found: ${path.relative(ROOT, dumpPath)} (use --dump=<file>)`);
  const tables = parseDump(fs.readFileSync(dumpPath, "utf8"));
  const withData = [...tables.values()].filter(t => t.expectedRows > 0 && !SKIP_TABLES.has(t.name));
  const expectedTotal = withData.reduce((sum, t) => sum + t.expectedRows, 0);
  log("load-data", `export has ${tables.size} tables, ${withData.length} with data, ${expectedTotal} rows`);

  if (!ctx.apply) {
    return { ok: true, tablesInExport: tables.size, tablesWithData: withData.length, expectedRows: expectedTotal, perTable: Object.fromEntries(withData.map(t => [t.name, t.expectedRows])) };
  }

  const db = await connectDb(ctx.env);
  try {
    const database = await dbName(db);
    await db.query("SET FOREIGN_KEY_CHECKS=0, UNIQUE_CHECKS=0, sql_mode='NO_AUTO_VALUE_ON_ZERO', time_zone='+00:00'");
    const existing = new Set(await listTables(db));
    if (ctx.env.target === "production") {
      const notEmpty: Record<string, number> = {};
      for (const table of withData) {
        if (!existing.has(table.name)) continue;
        const [rows] = await db.query(`SELECT COUNT(*) AS n FROM \`${table.name}\``);
        const n = Number((rows as Array<{ n: number | string }>)[0].n);
        if (n > 0) notEmpty[table.name] = n;
      }
      if (Object.keys(notEmpty).length > 0) {
        log("load-data", `REFUSING: production database is not empty (${Object.keys(notEmpty).length} tables already have rows); nothing was written`);
        return { ok: false, database, refused: "production database is not empty", tablesWithRows: Object.keys(notEmpty).length, notEmpty };
      }
    }
    const createdFromExport: string[] = [];
    const perTable: Record<string, { expected: number; loaded: number; ok: boolean }> = {};
    const failures: Array<{ table: string; error: string }> = [];

    for (const table of withData) {
      try {
        if (!existing.has(table.name)) {
          await db.query(table.ddl);
          createdFromExport.push(table.name);
        }
        if (ctx.env.target !== "production") await db.query(`TRUNCATE TABLE \`${table.name}\``);
        for (const insert of table.inserts) await withRetry(() => db.query(withColumnList(insert, table.columns)));
        const [rows] = await db.query(`SELECT COUNT(*) AS n FROM \`${table.name}\``);
        const loaded = Number((rows as Array<{ n: number | string }>)[0].n);
        perTable[table.name] = { expected: table.expectedRows, loaded, ok: loaded === table.expectedRows };
      } catch (error) {
        failures.push({ table: table.name, error: ((error as { code?: string }).code ?? "error") + ": " + (error as Error).message.slice(0, 160) });
      }
    }
    const loadedTotal = Object.values(perTable).reduce((sum, t) => sum + t.loaded, 0);
    const mismatched = Object.entries(perTable).filter(([, t]) => !t.ok).map(([name]) => name);
    log("load-data", `loaded ${loadedTotal}/${expectedTotal} rows into ${database}; ${mismatched.length} count mismatches, ${failures.length} failed tables, ${createdFromExport.length} tables created from the export's DDL`);
    return {
      ok: failures.length === 0 && mismatched.length === 0 && loadedTotal === expectedTotal,
      database,
      expectedRows: expectedTotal,
      loadedRows: loadedTotal,
      tablesWithData: withData.length,
      mismatched,
      failures,
      createdFromExport,
      perTable,
    };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  runStep("load-data", apply ? "apply" : "dry-run", async () => run({ env: loadTargetEnv(args), args, apply })).then(finish);
}
