# Staging rehearsal

**Status: tooling built and tested offline. The two staging runs have NOT been executed yet** because there is no `.env.staging`. Every timing below is marked "not run"; nothing in this document is measured unless it says so.

## 1. How to run it

1. Create a **separate** staging TiDB database (empty) and a **separate** staging Supabase project, and deploy the API from this branch to a staging Railway service.
2. `cp .env.staging.example .env.staging` and fill it in. The scripts refuse to run unless `MIGRATION_TARGET=staging` and the database and Supabase project differ from `.env` (tested).
3. Put the inputs in place: the SQL export (`full-database-dump.sql`), `phase0/manifest.csv`, and the files either in `phase0/files/<key>` or in the Manus archive `just-putzit-storage/` (the upload script falls back to its `STORAGE-MANIFEST.tsv`).
4. Plan (no writes): `pnpm migration:run-all`
5. Real run: `pnpm migration:run-all --apply` (each changing step does a dry-run, then applies, then the checks run). Add `--skip-cron-run` to keep the smoke test from running the three scraping jobs.
6. Start over: `pnpm migration:wipe` (dry-run), then `pnpm migration:wipe --apply --confirm=<staging database name>`, then step 5 again.

Reports go to `migration/reports/<step>.json` (git-ignored). Logs and reports hold counts and numeric ids only: no emails, names, hashes or keys.

| Step | Script | Mode | Notes |
|---|---|---|---|
| 0 | `migrate.ts` | dry-run / `--apply` | schema from the export's DDL, then `drizzle/*.sql` |
| 1 | `verify-schema.ts` | read-only | tables, columns, nullability vs `drizzle/schema.ts` |
| 2 | `load-data.ts` | dry-run / `--apply` | rows per table vs the export |
| 3 | `import-users.ts` | dry-run / `--apply` | Supabase auth users, `openId` → Supabase id, old id → `legacyOpenId` |
| 4 | `upload-files.ts` | dry-run / `--apply` | same keys, bucket by table/column, skips existing |
| 5 | `rewrite-urls.ts` | dry-run / `--apply` | `--form=bare\|supabase`, one transaction per table |
| 6 | `verify-files.ts` | read-only | HEAD each key (signed URL for private) |
| 7 | `smoke-test.ts` | HTTP | `/health`, public + protected tRPC, storage redirect, cron routes |
| – | `run-all.ts` | orchestrator | timing table, stops on first failure |
| – | `wipe-staging.ts` | dry-run / `--apply` | drops tables, deletes auth users and objects |

## 2. Timings

| Step | Run 1 (first, from empty) | Run 2 (after wipe) |
|---|---|---|
| migrate | not run | not run |
| verify-schema | not run | not run |
| load-data | not run | not run |
| import-users | not run | not run |
| upload-files | not run | not run |
| rewrite-urls | not run | not run |
| verify-files | not run | not run |
| smoke-test | not run | not run |
| **total** | not run | not run |

## 3. What testing offline already found

Checked without any database: the real export, the 64 migration files, `drizzle/schema.ts`, and 13 unit tests of the parsers and plans (`migration/migration.test.ts`, passing).

1. **The migrations do not describe the live database.** The 64 files in `drizzle/` create **71** tables; the live export has **113**; `schema.ts` defines 101. **43 live tables are created by no migration at all** (for example `voice_messages`, `gyms`, `game_questions`, `seeded_cities`, `organization_*`, `event_alert_*`). Fix: `migrate.ts` first builds the baseline from the export's own DDL, then applies the numbered migrations on top.
2. **`drizzle-kit migrate` would skip 40 of 64 files.** `drizzle/meta/_journal.json` only lists 0000–0022. Fix: `migrate.ts` applies every numbered file and tracks them in `__migration_rehearsal`.
3. **TiDB rejects `DEFAULT ('[]')` / `DEFAULT ('{}')` on JSON columns** (9 occurrences; first seen when importing earlier). Rewritten to `JSON_ARRAY()` / `JSON_OBJECT()`.
4. **mysqldump INSERTs have no column list**, so values are positional. Adding `users.legacyOpenId` would have shifted or broken every `users` insert. Fix: `load-data.ts` adds the export's column list to each INSERT.
5. **Schema drift to decide on:**
   - 13 live tables are not in `schema.ts` (`jeopardy_questions`, `trivia_pursuit_questions`, `organization_claims`, `organization_event_submissions`, `organization_invite_links`, `organization_memberships`, `event_alert_deliveries`, `event_alert_preferences`, `activity_alert_deliveries`, `external_event_rsvps`, `featured_venue_listings`, `date_night_packages`, `campus_email_tokens`). `verify-schema` reports them as extra tables (a warning, not a failure). Someone should confirm whether the app still uses them.
   - `game_chat_messages_v2` is in `schema.ts` but **not in the live database**; it only appears because a migration creates it. If the cutover used the export alone, game chat would break.
6. **Migration `0029` holds two statements with no breakpoint**, so the runner uses multi-statement mode.
7. **`phase0/files/` does not exist.** The 15 member photos live in the Manus archive `just-putzit-storage/`; `upload-files.ts` falls back to its manifest. `phase0/manifest.csv` only references one column (`profile_photos.url`, 15 rows, 15 keys).
8. **`rewrite-urls` is not needed by the Phase 1 server** (the storage proxy resolves `/manus-storage/<key>` itself). `--form=bare` would break photo display until the app is changed, so `run-all` only dry-runs it unless you pass `--rewrite-urls=<form>`.
9. **`tsconfig.json` had no `target`**, so iterating a `Map` failed to type-check; set to `ES2022` (type-check only; Vite and esbuild do the builds).
10. **New migration** `drizzle/0063_add_users_legacy_openid.sql`, hand-written (generating it would have tried to recreate the 40 unjournaled tables). `users.legacyOpenId` is used only by the migration scripts (raw SQL) and is **not declared in `schema.ts`**: declaring it made every user lookup, and so every sign-in, fail with `ER_BAD_FIELD_ERROR` on a database without the column, which is exactly what broke the first Google sign-ins on the deployed site.

Expected results from the Phase 0 data, to compare with the first real run: 114 tables in the export (58 with data, 5,467 rows excluding `__drizzle_migrations`); 11 users, none with a password hash, all with an email, so `import-users` should create **11 email-only auth users**; 15 files to upload, all private.

## 4. Proposed cutover order

Rehearsed steps are the ones the scripts cover; the rest are manual.

1. **Before the window:** final staging run is green twice; production Supabase configured (Google provider, Confirm email on, redirect URLs, min password length 8); production Railway/Vercel deployed and pointing at an empty production database; Google and Maps keys set; DNS TTL lowered a day ahead.
2. **Freeze Manus:** put the Manus app in maintenance or read-only mode so no new data is written.
3. **Final export** from the Manus TiDB: SQL with data, plus the storage archive.
4. `migrate --apply` → `verify-schema` → `load-data --apply` (production target; same scripts, with a production env file and the guards deliberately relaxed by a reviewed change, never by editing the checks).
5. `import-users --apply` (dry-run first, review counts).
6. `upload-files --apply` → `verify-files`.
7. Start the production API; run `smoke-test --skip-cron-run`.
8. Switch DNS / deploy the frontend; confirm sign-in with Google as the admin account.
9. Enable the three Railway cron jobs; trigger each once by hand.
10. Watch logs and error rates; keep Manus read-only and untouched as the rollback target.

**Rollback:** until step 8, nothing has changed for members (Manus still serves). After step 8, point DNS back at Manus; any data written on the new stack since then would have to be exported back by hand, which is why the window should be kept short.

## 5. Estimated downtime

Not measured. Reasoning from what is known: the export is 1.6 MB with 5,467 rows, 11 users and 15 files (19 MB), so the data steps are small. An earlier manual import of the same export into TiDB completed in a single command, though I did not time it. The wall-clock time will be dominated by things the scripts cannot shorten: freezing and exporting from Manus, DNS propagation, and manual verification (sign-in, photos, cron).

Working estimate: **about 30–60 minutes of write freeze**, with most of it manual checking. Replace this with the measured total from the second rehearsal run once it exists.

## 6. Open risks

- **The rehearsal itself has not run.** Everything in section 3 is from reading files and unit tests; the scripts have not touched a database or Supabase. Expect a few fixes on the first real run.
- **Account linking depends on Supabase settings.** Google members are imported as email-only auth users; when they sign in with Google, Supabase must link the Google identity to that existing user (automatic linking of verified emails). Verify this on staging with a real Google account before cutover.
- **3 Apple members and 1 member with no login method** have no way in except "Forgot password"; tell them in advance.
- **Passkeys (4 credentials)** only work if the production `WEBAUTHN_RP_ID` and domain match what they were registered on.
- **Schema drift** (section 3, item 5): decide about the 13 live-only tables and make sure `game_chat_messages_v2` exists in production.
- **Free-tier limits and rate limits** on Supabase admin calls and TiDB connections (the connection dropped several times earlier); the scripts retry transient errors, but a full run on a small tier may be slow.
- **Smoke test runs the cron jobs** unless `--skip-cron-run` is given; they scrape external sites and write to the staging database.
- **No production runbook exists yet** for relaxing the staging-only guards; that needs an explicit, reviewed change.
- **Secrets pasted into chat earlier** (database password, Supabase key fragment, Gemini key) should be rotated before production.
