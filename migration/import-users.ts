// Step 3: create a Supabase auth user for every member in the staging database.
//
// - With a bcrypt passwordHash: the hash is imported, so the member keeps their password.
// - Without one: email only, email_confirm true, no password (they use Google or "Forgot password").
// - users.openId becomes the Supabase user id; the old value is kept in users.legacyOpenId first.
// - Members without an email are skipped and reported by id.
// - Dry-run by default; --apply is required to change anything. Safe to re-run: members whose openId is
//   already a Supabase id (with legacyOpenId set) are skipped, and an auth user that already exists for an
//   email is reused instead of failing.
// Logs and reports contain counts and numeric ids only: never emails, names or hashes.

import type { SupabaseClient } from "@supabase/supabase-js";
import { connectDb, finish, isMain, loadTargetEnv, log, parseArgs, runStep, sleep, supabaseAdmin, withRetry, type Db, type StepContext } from "./lib";
import { planUsers, type UserRow } from "./sql";

const CONCURRENCY = 4;

async function hasColumn(db: Db, table: string, column: string) {
  const [rows] = await db.query("SELECT 1 AS x FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?", [table, column]);
  return (rows as unknown[]).length > 0;
}

/** email -> auth user id for everyone already in Supabase Auth (used to make re-runs idempotent). */
async function existingAuthUsers(supabase: SupabaseClient): Promise<Map<string, string>> {
  const byEmail = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await withRetry(() => supabase.auth.admin.listUsers({ page, perPage: 1000 }));
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const user of data.users) if (user.email) byEmail.set(user.email.toLowerCase(), user.id);
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

export async function run(ctx: StepContext, deps: { supabase?: SupabaseClient } = {}) {
  const db = await connectDb(ctx.env);
  try {
    const columnPresent = await hasColumn(db, "users", "legacyOpenId");
    if (!columnPresent && ctx.apply) {
      await db.query("ALTER TABLE `users` ADD `legacyOpenId` varchar(64)"); // same change as drizzle/0063
      log("import-users", "added users.legacyOpenId");
    }
    const legacySelect = columnPresent || ctx.apply ? "legacyOpenId" : "NULL AS legacyOpenId";
    const [rows] = await db.query(`SELECT id, openId, ${legacySelect}, email, passwordHash FROM users ORDER BY id`);
    const users = rows as UserRow[];
    const plan = planUsers(users);
    const summary = {
      usersInDatabase: users.length,
      toImportWithPassword: plan.withHash.length,
      toImportWithoutPassword: plan.withoutHash.length,
      skippedNoEmail: plan.skippedNoEmail,
      skippedDuplicateEmail: plan.skippedDuplicateEmail,
      alreadyImported: plan.alreadyImported.length,
      passwordHashNotUsable: plan.unusableHash,
      legacyColumnPresent: columnPresent,
    };
    log("import-users", `${users.length} users: ${plan.withHash.length} with password, ${plan.withoutHash.length} email-only, ${plan.skippedNoEmail.length} without email, ${plan.skippedDuplicateEmail.length} duplicate email, ${plan.alreadyImported.length} already imported`);
    if (!ctx.apply) return { ok: true, ...summary };

    const supabase = deps.supabase ?? supabaseAdmin(ctx.env);
    const known = await existingAuthUsers(supabase);
    const created: number[] = [];
    const reused: number[] = [];
    const failed: Array<{ id: number; error: string }> = [];

    const importOne = async (user: UserRow, withPassword: boolean) => {
      try {
        const email = user.email!.trim().toLowerCase();
        let authId = known.get(email);
        if (authId) reused.push(user.id);
        else {
          const { data, error } = await withRetry(() =>
            supabase.auth.admin.createUser({
              email,
              email_confirm: true,
              ...(withPassword ? { password_hash: user.passwordHash! } : {}),
              user_metadata: { legacy_user_id: user.id },
            }),
          );
          if (error || !data.user) throw new Error(error?.message ?? "no user returned");
          authId = data.user.id;
          known.set(email, authId);
          created.push(user.id);
        }
        // Keep the first-ever openId: a re-run after a partial failure must not overwrite it.
        await db.query("UPDATE users SET legacyOpenId = COALESCE(legacyOpenId, openId), openId = ? WHERE id = ?", [authId, user.id]);
      } catch (error) {
        failed.push({ id: user.id, error: (error as Error).message.slice(0, 120).replace(/[^\s]+@[^\s]+/g, "<email>") });
      }
    };

    const queue = [...plan.withHash.map(u => [u, true] as const), ...plan.withoutHash.map(u => [u, false] as const)];
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      await Promise.all(queue.slice(i, i + CONCURRENCY).map(([user, withPassword]) => importOne(user, withPassword)));
      await sleep(100);
    }

    log("import-users", `created ${created.length}, reused ${reused.length}, failed ${failed.length}`);
    return { ok: failed.length === 0, ...summary, created: created.length, reusedExistingAuthUser: reused.length, failed };
  } finally {
    await db.end();
  }
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  const apply = args.flags.has("apply");
  runStep("import-users", apply ? "apply" : "dry-run", async () => run({ env: loadTargetEnv(args), args, apply })).then(finish);
}
