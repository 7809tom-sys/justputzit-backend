// Step 4: upload the files named in phase0/manifest.csv to the staging Supabase buckets, same keys.
//
// Source files: <files-dir>/<key> (default ./phase0/files), falling back to the Manus storage archive
// (just-putzit-storage/STORAGE-MANIFEST.tsv). Bucket by table and column (member content is private).
// Dry-run by default; --apply uploads. Existing objects are skipped, so re-runs are safe.

import fs from "node:fs";
import path from "node:path";
import { ROOT, finish, isMain, loadTargetEnv, log, parseArgs, runStep, sleep, supabaseAdmin, withRetry, type StepContext } from "./lib";
import { parseManifest, visibilityFor } from "./sql";

const CONTENT_TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".mp3": "audio/mpeg", ".webm": "audio/webm", ".mp4": "video/mp4" };

export type PlannedFile = { key: string; visibility: "public" | "private"; source: string | null };

/** Unique keys from the manifest with the bucket they belong to and where to read them from. */
export function planUploads(manifestCsv: string, filesDir: string, archiveDir: string): PlannedFile[] {
  const archive = new Map<string, string>();
  const tsv = path.join(archiveDir, "STORAGE-MANIFEST.tsv");
  if (fs.existsSync(tsv)) {
    for (const line of fs.readFileSync(tsv, "utf8").split(/\r?\n/)) {
      const cells = line.split("\t");
      if (cells.length >= 4 && cells[2].startsWith("/manus-storage/")) archive.set(cells[2].slice("/manus-storage/".length), path.join(archiveDir, cells[3]));
    }
  }
  const seen = new Map<string, PlannedFile>();
  for (const row of parseManifest(manifestCsv)) {
    if (seen.has(row.key)) continue;
    const direct = path.join(filesDir, row.key);
    const source = fs.existsSync(direct) ? direct : archive.get(row.key) && fs.existsSync(archive.get(row.key)!) ? archive.get(row.key)! : null;
    seen.set(row.key, { key: row.key, visibility: visibilityFor(row.table, row.column, row.key), source });
  }
  return [...seen.values()];
}

export async function run(ctx: StepContext) {
  const manifestPath = path.resolve(ROOT, ctx.args.values.manifest ?? "phase0/manifest.csv");
  const filesDir = path.resolve(ROOT, ctx.args.values["files-dir"] ?? "phase0/files");
  const archiveDir = path.resolve(ROOT, ctx.args.values.archive ?? "just-putzit-storage");
  const plan = planUploads(fs.readFileSync(manifestPath, "utf8"), filesDir, archiveDir);
  const missingSource = plan.filter(f => !f.source).map(f => f.key);
  const bytes = plan.reduce((sum, f) => sum + (f.source ? fs.statSync(f.source).size : 0), 0);
  const count = (v: "public" | "private") => plan.filter(f => f.visibility === v).length;
  log("upload-files", `${plan.length} files (${count("public")} public, ${count("private")} private), ${(bytes / 1e6).toFixed(1)} MB, ${missingSource.length} without a local source`);
  const summary = { files: plan.length, public: count("public"), private: count("private"), bytes, missingSource };
  if (!ctx.apply) return { ok: missingSource.length === 0, ...summary };

  const supabase = supabaseAdmin(ctx.env);
  const buckets = { public: ctx.env.publicBucket, private: ctx.env.privateBucket } as const;
  for (const visibility of ["public", "private"] as const) {
    const { error } = await withRetry(() => supabase.storage.createBucket(buckets[visibility], { public: visibility === "public" }));
    if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(`createBucket ${visibility}: ${error.message}`);
  }

  const uploaded: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ key: string; error: string }> = [];
  for (const file of plan) {
    if (!file.source) {
      failed.push({ key: file.key, error: "no local source file" });
      continue;
    }
    try {
      const bucket = buckets[file.visibility];
      const dir = path.posix.dirname(file.key);
      const name = path.posix.basename(file.key);
      const { data: existing } = await withRetry(() => supabase.storage.from(bucket).list(dir === "." ? "" : dir, { search: name, limit: 100 }));
      if (existing?.some(o => o.name === name)) {
        skipped.push(file.key);
        continue;
      }
      const { error } = await withRetry(() =>
        supabase.storage.from(bucket).upload(file.key, fs.readFileSync(file.source!), {
          contentType: CONTENT_TYPES[path.extname(file.key).toLowerCase()] ?? "application/octet-stream",
          upsert: false,
        }),
      );
      if (error && /already exists|duplicate/i.test(error.message)) skipped.push(file.key);
      else if (error) failed.push({ key: file.key, error: error.message.slice(0, 120) });
      else uploaded.push(file.key);
      await sleep(50);
    } catch (error) {
      failed.push({ key: file.key, error: (error as Error).message.slice(0, 120) });
    }
  }
  log("upload-files", `uploaded ${uploaded.length}, skipped existing ${skipped.length}, failed ${failed.length}`);
  return { ok: failed.length === 0, ...summary, uploaded: uploaded.length, skippedExisting: skipped.length, failed };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  runStep("upload-files", apply ? "apply" : "dry-run", async () => run({ env: loadTargetEnv(args), args, apply })).then(finish);
}
