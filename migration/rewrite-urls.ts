// Step 5: rewrite '/manus-storage/<key>' values in the columns listed in phase0/manifest.csv.
//
//   --form=bare       '/manus-storage/<key>'  ->  '<key>'
//   --form=supabase   '/manus-storage/<key>'  ->  '<SUPABASE_URL>/storage/v1/object/[public/]<bucket>/<key>'
//
// One transaction per table; rolled back if any '/manus-storage/' value is left afterwards.
// Dry-run by default (counts only); --apply writes. Re-running is a no-op.
//
// NOTE: the Phase 1 server still serves '/manus-storage/<key>' through its storage proxy and expects that
// form in the database. Rewriting is optional, and `--form=bare` needs an app change before it is useful.

import fs from "node:fs";
import path from "node:path";
import { ROOT, connectDb, finish, isMain, loadTargetEnv, log, parseArgs, runStep, type StepContext } from "./lib";
import { parseManifest, replacementPrefix, visibilityFor, type UrlForm } from "./sql";

const NEEDLE = "/manus-storage/";

export async function run(ctx: StepContext) {
  const form = (ctx.args.values.form ?? "supabase") as UrlForm;
  if (form !== "bare" && form !== "supabase") throw new Error('--form must be "bare" or "supabase"');
  const manifest = parseManifest(fs.readFileSync(path.resolve(ROOT, ctx.args.values.manifest ?? "phase0/manifest.csv"), "utf8"));

  const columns = new Map<string, { table: string; column: string; sampleKey: string }>();
  for (const row of manifest) if (!columns.has(`${row.table}.${row.column}`)) columns.set(`${row.table}.${row.column}`, { table: row.table, column: row.column, sampleKey: row.key });
  const byTable = new Map<string, Array<{ column: string; sampleKey: string }>>();
  for (const { table, column, sampleKey } of columns.values()) byTable.set(table, [...(byTable.get(table) ?? []), { column, sampleKey }]);

  const db = await connectDb(ctx.env);
  try {
    const perTable: Record<string, { column: string; before: number; after: number | null; changed: number }[]> = {};
    const problems: string[] = [];

    for (const [table, cols] of byTable) {
      perTable[table] = [];
      const [typeRows] = await db.query("SELECT column_name AS c, data_type AS d FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?", [table]);
      const types = new Map((typeRows as Array<Record<string, string>>).map(r => [r.c ?? r.COLUMN_NAME, (r.d ?? r.DATA_TYPE).toLowerCase()]));
      if (types.size === 0) {
        problems.push(`${table}: table not found`);
        continue;
      }

      const counts = async (column: string) => {
        const [rows] = await db.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` LIKE ?`, [`%${NEEDLE}%`]);
        return Number((rows as Array<{ n: number | string }>)[0].n);
      };

      if (!ctx.apply) {
        for (const { column } of cols) {
          if (!types.has(column)) problems.push(`${table}.${column}: column not found`);
          else perTable[table].push({ column, before: await counts(column), after: null, changed: 0 });
        }
        continue;
      }

      await db.beginTransaction();
      try {
        for (const { column, sampleKey } of cols) {
          if (!types.has(column)) throw new Error(`${table}.${column}: column not found`);
          if (types.get(column) === "json") throw new Error(`${table}.${column}: JSON columns are not supported by this rewrite`);
          const before = await counts(column);
          const prefix = replacementPrefix(form, visibilityFor(table, column, sampleKey), ctx.env.supabaseUrl, { public: ctx.env.publicBucket, private: ctx.env.privateBucket });
          const [result] = await db.query(`UPDATE \`${table}\` SET \`${column}\` = REPLACE(\`${column}\`, ?, ?) WHERE \`${column}\` LIKE ?`, [NEEDLE, prefix, `%${NEEDLE}%`]);
          const after = await counts(column);
          if (after !== 0) throw new Error(`${table}.${column}: ${after} values still contain ${NEEDLE} after the update`);
          perTable[table].push({ column, before, after, changed: Number((result as { affectedRows?: number }).affectedRows ?? 0) });
        }
        await db.commit();
      } catch (error) {
        await db.rollback();
        perTable[table] = [];
        problems.push(`${table}: rolled back (${(error as Error).message.slice(0, 140)})`);
      }
    }

    const totalBefore = Object.values(perTable).flat().reduce((sum, c) => sum + c.before, 0);
    const totalChanged = Object.values(perTable).flat().reduce((sum, c) => sum + c.changed, 0);
    log("rewrite-urls", `form=${form}: ${totalBefore} values contain ${NEEDLE}${ctx.apply ? `, ${totalChanged} rewritten` : " (dry-run)"}, ${problems.length} problems`);
    return { ok: problems.length === 0, form, columns: columns.size, tables: byTable.size, totalBefore, totalChanged, perTable, problems };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  runStep("rewrite-urls", apply ? "apply" : "dry-run", async () => run({ env: loadTargetEnv(args), args, apply })).then(finish);
}
