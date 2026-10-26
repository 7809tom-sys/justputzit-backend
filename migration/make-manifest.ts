// Rebuilds the file manifest from the FINAL Manus export, offline (no database, no network).
//
//   tsx migration/make-manifest.ts [--dump=full-database-dump.sql] [--out=phase0/manifest.csv] [--archive=just-putzit-storage] [--files-dir=phase0/files]
//
// Run it on cutover day after the final export: members keep uploading photos, so the Phase 0 manifest goes
// stale. Writes manifest.csv (table, column, row id, key) and reports keys that are in the export but missing
// from the storage archive. Counts and keys only; no other column values are read into the report.

import fs from "node:fs";
import path from "node:path";
import { ROOT, finish, isMain, log, parseArgs, runStep } from "./lib";
import { manifestFromDump, parseDump } from "./sql";
import { planUploads } from "./upload-files";

export async function run(args: ReturnType<typeof parseArgs>) {
  const dumpPath = path.resolve(ROOT, args.values.dump ?? "full-database-dump.sql");
  if (!fs.existsSync(dumpPath)) throw new Error(`Export not found: ${path.relative(ROOT, dumpPath)}`);
  const out = path.resolve(ROOT, args.values.out ?? "phase0/manifest.csv");
  const rows = manifestFromDump(parseDump(fs.readFileSync(dumpPath, "utf8")));

  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const csv = "table,column,row_id,key\n" + rows.map(r => [r.table, r.column, r.rowId, r.key].map(q).join(",")).join("\n") + (rows.length ? "\n" : "");
  const previous = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
  fs.writeFileSync(out, csv);

  const plan = planUploads(csv, path.resolve(ROOT, args.values["files-dir"] ?? "phase0/files"), path.resolve(ROOT, args.values.archive ?? "just-putzit-storage"));
  const missing = plan.filter(f => !f.source).map(f => f.key);
  const byColumn: Record<string, number> = {};
  for (const r of rows) byColumn[`${r.table}.${r.column}`] = (byColumn[`${r.table}.${r.column}`] ?? 0) + 1;
  const previousKeys = new Set([...previous.matchAll(/"((?:[^"]|"")*)"\s*$/gm)].map(m => m[1]));
  const newKeys = plan.filter(f => previousKeys.size > 0 && !previousKeys.has(f.key)).length;

  log("make-manifest", `${rows.length} references, ${plan.length} unique keys in ${Object.keys(byColumn).length} column(s); ${newKeys} not in the previous manifest; ${missing.length} without a file in the archive`);
  return { ok: missing.length === 0, references: rows.length, uniqueKeys: plan.length, columns: byColumn, newSincePreviousManifest: newKeys, missingFromArchive: missing, manifestWritten: path.relative(ROOT, out) };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  runStep("make-manifest", "apply", () => run(args)).then(finish);
}
