// Wipes STAGING so the rehearsal can be run again from scratch: drops every table in the staging database,
// deletes every Supabase auth user, and empties the two storage buckets (the buckets themselves stay).
//
// Dry-run by default. --apply additionally needs --confirm=<staging database name>, so a wrong
// .env.staging cannot wipe the wrong place. Staging only: loadStagingEnv() refuses anything else.

import type { SupabaseClient } from "@supabase/supabase-js";
import { connectDb, dbName, finish, isMain, listTables, loadStagingEnv, log, parseArgs, runStep, supabaseAdmin, withRetry, type StepContext } from "./lib";

async function listObjects(supabase: SupabaseClient, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await withRetry(() => supabase.storage.from(bucket).list(prefix, { limit: 1000 }));
  if (error) return out; // bucket does not exist yet
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id) out.push(full);
    else out.push(...(await listObjects(supabase, bucket, full)));
  }
  return out;
}

export async function run(ctx: StepContext) {
  const supabase = supabaseAdmin(ctx.env);
  const db = await connectDb(ctx.env);
  try {
    const database = await dbName(db);
    const tables = await listTables(db);

    const authIds: string[] = [];
    for (let page = 1; ; page++) {
      const { data, error } = await withRetry(() => supabase.auth.admin.listUsers({ page, perPage: 1000 }));
      if (error) throw new Error(`listUsers failed: ${error.message}`);
      authIds.push(...data.users.map(u => u.id));
      if (data.users.length < 1000) break;
    }
    const objects = {
      public: await listObjects(supabase, ctx.env.publicBucket),
      private: await listObjects(supabase, ctx.env.privateBucket),
    };
    const plan = { database, tables: tables.length, authUsers: authIds.length, publicObjects: objects.public.length, privateObjects: objects.private.length };
    log("wipe-staging", `would remove ${plan.tables} tables from "${database}", ${plan.authUsers} auth users, ${plan.publicObjects + plan.privateObjects} storage objects`);
    if (!ctx.apply) return { ok: true, ...plan };

    if (ctx.args.values.confirm !== database) throw new Error(`Refusing to wipe: pass --confirm=${database} to confirm the staging database name.`);

    await db.query("SET FOREIGN_KEY_CHECKS=0");
    for (const table of tables) await db.query(`DROP TABLE IF EXISTS \`${table}\``);
    let authDeleted = 0;
    for (const id of authIds) {
      const { error } = await withRetry(() => supabase.auth.admin.deleteUser(id));
      if (!error) authDeleted++;
    }
    let objectsDeleted = 0;
    for (const [bucket, keys] of [[ctx.env.publicBucket, objects.public], [ctx.env.privateBucket, objects.private]] as const) {
      for (let i = 0; i < keys.length; i += 100) {
        const { error } = await withRetry(() => supabase.storage.from(bucket).remove(keys.slice(i, i + 100)));
        if (!error) objectsDeleted += Math.min(100, keys.length - i);
      }
    }
    log("wipe-staging", `dropped ${tables.length} tables, deleted ${authDeleted} auth users and ${objectsDeleted} objects`);
    return { ok: authDeleted === authIds.length && objectsDeleted === plan.publicObjects + plan.privateObjects, ...plan, authDeleted, objectsDeleted };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  runStep("wipe-staging", apply ? "apply" : "dry-run", async () => run({ env: loadStagingEnv(), args, apply })).then(finish);
}
