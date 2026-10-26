// Step 6: check that every key in phase0/manifest.csv resolves in Supabase Storage (--target picks the environment).
// Public objects: HEAD on the public URL. Private objects: a signed URL, then HEAD. Read-only.
// --sample=N checks a random sample of N keys instead of all of them.

import fs from "node:fs";
import path from "node:path";
import { ROOT, finish, isMain, loadTargetEnv, log, parseArgs, runStep, supabaseAdmin, withRetry, type StepContext } from "./lib";
import { parseManifest, visibilityFor } from "./sql";

const CONCURRENCY = 5;

async function reachable(url: string): Promise<number> {
  let res = await withRetry(() => fetch(url, { method: "HEAD" }));
  // Some storage gateways answer HEAD with 405; a one-byte range GET proves the same thing.
  if (res.status === 405) res = await withRetry(() => fetch(url, { headers: { Range: "bytes=0-0" } }));
  return res.status;
}

export async function run(ctx: StepContext) {
  const manifest = parseManifest(fs.readFileSync(path.resolve(ROOT, ctx.args.values.manifest ?? "phase0/manifest.csv"), "utf8"));
  const unique = new Map<string, "public" | "private">();
  for (const row of manifest) if (!unique.has(row.key)) unique.set(row.key, visibilityFor(row.table, row.column, row.key));

  const supabase = supabaseAdmin(ctx.env);
  const base = ctx.env.supabaseUrl.replace(/\/+$/, "");
  const broken: Array<{ key: string; visibility: string; status: number | string }> = [];
  let okCount = 0;

  const check = async ([key, visibility]: [string, "public" | "private"]) => {
    try {
      let url: string;
      if (visibility === "public") url = `${base}/storage/v1/object/public/${ctx.env.publicBucket}/${key}`;
      else {
        const { data, error } = await withRetry(() => supabase.storage.from(ctx.env.privateBucket).createSignedUrl(key, 120));
        if (error || !data?.signedUrl) {
          broken.push({ key, visibility, status: "no signed url" });
          return;
        }
        url = data.signedUrl;
      }
      const status = await reachable(url);
      if (status >= 200 && status < 300) okCount++;
      else broken.push({ key, visibility, status });
    } catch (error) {
      broken.push({ key, visibility, status: (error as Error).message.slice(0, 60) });
    }
  };

  let entries = [...unique.entries()];
  const sample = Number(ctx.args.values.sample ?? 0);
  if (sample > 0 && sample < entries.length) {
    // Fisher-Yates shuffle, then take the first N.
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    entries = entries.slice(0, sample);
  }
  for (let i = 0; i < entries.length; i += CONCURRENCY) await Promise.all(entries.slice(i, i + CONCURRENCY).map(check));

  log("verify-files", `${okCount}/${entries.length} keys resolve, ${broken.length} broken`);
  return { ok: broken.length === 0, keys: entries.length, keysInManifest: unique.size, sampled: sample > 0 && sample < unique.size, resolved: okCount, broken };
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  runStep("verify-files", "read-only", async () => run({ env: loadTargetEnv(args), args, apply: false })).then(finish);
}
