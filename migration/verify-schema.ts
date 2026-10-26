// Step 1: compare the staging database with drizzle/schema.ts (table names, column names, nullability).
// Read-only. Missing tables or columns fail the step; extra ones in the database are reported as warnings.

import { getTableConfig, MySqlTable } from "drizzle-orm/mysql-core";
import { is } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { connectDb, finish, isMain, loadTargetEnv, log, parseArgs, runStep, type StepContext } from "./lib";

// Bookkeeping tables that are not part of the app schema.
const IGNORED_TABLES = new Set(["__drizzle_migrations", "__migration_rehearsal"]);

type Expected = Map<string, Map<string, { notNull: boolean }>>;

export function expectedSchema(): Expected {
  const tables: Expected = new Map();
  for (const value of Object.values(schema)) {
    if (!is(value, MySqlTable)) continue;
    const config = getTableConfig(value);
    tables.set(config.name, new Map(config.columns.map(c => [c.name, { notNull: c.notNull }])));
  }
  return tables;
}

export async function run(ctx: StepContext) {
  const expected = expectedSchema();
  const db = await connectDb(ctx.env);
  try {
    const [tableRows] = await db.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
    const actualTables = new Set((tableRows as Array<Record<string, string>>).map(r => r.t ?? r.T ?? r.TABLE_NAME).filter(t => !IGNORED_TABLES.has(t)));
    const [colRows] = await db.query("SELECT table_name AS t, column_name AS c, is_nullable AS n FROM information_schema.columns WHERE table_schema = DATABASE()");
    const actual = new Map<string, Map<string, { notNull: boolean }>>();
    for (const row of colRows as Array<Record<string, string>>) {
      const t = row.t ?? row.T ?? row.TABLE_NAME;
      const c = row.c ?? row.C ?? row.COLUMN_NAME;
      const n = row.n ?? row.N ?? row.IS_NULLABLE;
      if (!actual.has(t)) actual.set(t, new Map());
      actual.get(t)!.set(c, { notNull: n === "NO" });
    }

    const missingTables = [...expected.keys()].filter(t => !actualTables.has(t));
    const extraTables = [...actualTables].filter(t => !expected.has(t));
    const missingColumns: string[] = [];
    const extraColumns: string[] = [];
    const nullabilityMismatches: string[] = [];
    for (const [table, columns] of expected) {
      const have = actual.get(table);
      if (!have) continue;
      for (const [column, def] of columns) {
        const found = have.get(column);
        if (!found) missingColumns.push(`${table}.${column}`);
        // An auto-increment primary key is NOT NULL in the database whichever way the schema spells it.
        else if (def.notNull !== found.notNull) nullabilityMismatches.push(`${table}.${column}`);
      }
      for (const column of have.keys()) if (!columns.has(column)) extraColumns.push(`${table}.${column}`);
    }

    const ok = missingTables.length === 0 && missingColumns.length === 0;
    log("verify-schema", `schema tables ${expected.size}, database tables ${actualTables.size}; missing tables ${missingTables.length}, missing columns ${missingColumns.length}, extra tables ${extraTables.length}, extra columns ${extraColumns.length}, nullability mismatches ${nullabilityMismatches.length}`);
    return {
      ok,
      schemaTables: expected.size,
      databaseTables: actualTables.size,
      missingTables,
      missingColumns,
      extraTables,
      extraColumns,
      nullabilityMismatches,
    };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  runStep("verify-schema", "read-only", async () => run({ env: loadTargetEnv(args), args, apply: false })).then(finish);
}
