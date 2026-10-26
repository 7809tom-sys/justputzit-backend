# Cutover runbook: Manus to Vercel + Railway + TiDB + Supabase

**Owners:** `YOU` do every irreversible or outside-the-repo step (Manus freeze and export, DNS, Stripe, Railway/Vercel/Supabase dashboards, anything that shuts something down). `ME` (Claude) run only the scripts in `migration/`, and only for the step you name. Nothing here touches Manus; the scripts never connect to it, and they refuse to run if the target database is the Manus one.

**Working rules**
1. You tell me the step ("Step 5"). I run its **dry-run** (or read-only check) and report counts and anything unexpected, then **wait**.
2. I run a command with `--apply` only after you say **"apply"** for that step.
3. Commands marked `DELETE` (removing data) need your approval of that exact command. This runbook has two: the temporary test account in Step 12 and any rollback clean-up. The staging wipe script can never target production.
4. If any stop/go check fails, we stop. I do not continue to the next step on my own.

Approval classes used below: `READ` reads only · `WRITE` adds or changes production data (needs "apply") · `DELETE` removes data (exact-command approval).

All commands run from the repo root on branch `migrate/supabase-railway-vercel`. `T0` is the moment you freeze Manus.

## 0. Open items I need from you (fill in before the day)

| Item | Value |
|---|---|
| Cutover date and `T0` (with time zone) | ____________ |
| **Rollback deadline** (after this, we fix forward and do not roll back) | ____________ *(you set it; I'll copy it into section 5)* |
| DNS provider and current TTL (lower it to 300 s at least 24 h ahead) | ____________ |
| How you freeze Manus (maintenance page, read-only, or stop signups) | ____________ |
| Who is online and reachable during the window | ____________ |

## 1. Timeline (minute by minute)

**These are estimates.** `REHEARSAL.md` has no measured timings yet (the staging runs were not executed), so durations are reasoned from the data size (5,467 rows, 11 members, 15 files, 19 MB) plus manual work. Replace them with the measured numbers from the second rehearsal run. Writes to Manus stop at `T0`; members see the new site from about `T+60`.

| When (min) | Step | Owner | What |
|---|---|---|---|
| T-60 to T-30 | **0** | YOU | Pre-stage checklist complete (section 2) |
| T-30 to T-25 | **1** | ME | Preflight |
| T+0 to T+10 | **2** | YOU | Freeze Manus |
| T+10 to T+20 | **3** | YOU | Final export from Manus (SQL with data + storage archive) |
| T+20 to T+23 | **4** | ME | Rebuild the file manifest from the export |
| T+23 to T+28 | **5** | ME | Schema: migrate, then verify-schema |
| T+28 to T+33 | **6** | ME | Load data |
| T+33 to T+36 | **7** | ME | Import members into Supabase Auth |
| T+36 to T+41 | **8** | ME | Upload files, then verify-files |
| T+41 to T+46 | **9** | YOU | Stripe: register the production webhook |
| T+46 to T+60 | **10** | YOU | DNS switch (then wait for propagation) |
| T+60 to T+66 | **11** | ME | Postflight (safe checks) |
| T+66 to T+76 | **12** | YOU + ME | Sign-in and feature checks; test-account check |
| T+76 to T+90 | **13** | YOU + ME | Cron jobs enabled and run once |
| T+90 | **14** | YOU | Announce; Manus stays read-only (hold period) |

Estimated write freeze (T0 to DNS visible): about 60 minutes, inside the 30–60 minute working estimate in `REHEARSAL.md`.

## 2. Pre-stage checklist (YOU, days before; nothing here changes what members see)

- [ ] Both staging rehearsal runs are green and `REHEARSAL.md` has real timings.
- [ ] `.env.production` exists locally (never committed) with `MIGRATION_TARGET=production`, and these names (values stay private): `DATABASE_URL, SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_JWKS_URL, GEMINI_API_KEY, GOOGLE_MAPS_SERVER_KEY, CRON_SECRET, ADMIN_EMAILS, CORS_ORIGINS, VITE_SITE_URL, WEBAUTHN_RP_ID, WEBAUTHN_ORIGIN, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, OUTREACH_FROM_EMAIL, VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_GOOGLE_MAPS_KEY`. Optional `API_URL` / `SITE_URL` override the defaults `https://api.justputzit.com` / `https://justputzit.com`.
- [ ] **Production TiDB database is new and empty** (not the `justputzit` database that already holds the Phase 1 test import; that one has data and preflight will refuse it).
- [ ] Production Supabase project: buckets `site-public` (public) and `member-private` (private); Google provider on; **Confirm email ON**; password minimum 8; Site URL and redirect URLs include `https://justputzit.com/**`, `https://www.justputzit.com/**` (needed for sign-in and password reset); Google OAuth client has the Supabase callback and the production origins; SMTP configured.
- [ ] Railway production API service deployed with the production variables and reachable at its Railway URL (`/health` returns `{"status":"ok"}`). Domain `api.justputzit.com` added in Railway but **not yet pointed** by DNS. Cron services **not** created yet.
- [ ] Vercel production project deployed from this branch with the `VITE_*` variables; `vercel.json` has the real Railway domain in place of `REPLACE-WITH-RAILWAY-DOMAIN`; domains added but **not yet pointed** by DNS.
- [ ] Stripe: you know where the dashboard webhook page is; the Manus endpoint stays enabled until Step 14.
- [ ] DNS TTL lowered to 300 s at least 24 hours before; old records written down so they can be restored.
- [ ] Members told about the maintenance window; the 4 members without a password path (3 Apple, 1 unknown) told to use "Forgot password".

## 3. The steps

### Step 1: Preflight (ME) `READ`
```
npx tsx migration/preflight.ts
```
Expected: a table of 23 checks, then `Preflight passed (23 checks, N warning(s)).` Warnings may include `www` not in CORS, optional variables not set, API URL differing from the default.
Any `FAIL` prints a banner `PREFLIGHT FAILED ... DO NOT START THE CUTOVER` and exit code 1.
**STOP if** any check is `FAIL`, in particular: `production database is empty` (the database has rows), a bucket is missing or has the wrong visibility, `CRON_SECRET` is short, `CORS_ORIGINS` lacks `https://justputzit.com`, or the passkey settings do not match the domain.
**GO if** zero failures and you accept each warning.

### Step 2: Freeze Manus (YOU)
Put Manus into maintenance or read-only mode so no member data changes. Write down the exact time as `T0` and tell me.
**GO if** you confirm no writes are possible. (I cannot check Manus and will not try.)

### Step 3: Final export (YOU)
From Manus: a MySQL dump **with data** and the storage archive (profile photos). Put them in the repo folder as:
- `full-database-dump.sql` (first rename the Phase 0 file to `full-database-dump.phase0.sql`; renaming is not destructive)
- `just-putzit-storage/` (with its `STORAGE-MANIFEST.tsv`)
Tell me when both are in place.
**GO if** the dump ends with `-- Dump completed` and the archive folder holds the files.

### Step 4: Rebuild the file manifest (ME) `WRITE` (writes only `phase0/manifest.csv`)
```
npx tsx migration/make-manifest.ts
```
Expected (Phase 0 data for reference): `[make-manifest] 15 references, 15 unique keys in 1 column(s); N not in the previous manifest; 0 without a file in the archive`.
**STOP if** `without a file in the archive` is not 0: some member photo is referenced but missing from the archive; we decide together (re-export the archive) before continuing.
**GO if** it is 0. New keys since Phase 0 are expected (members upload photos).

### Step 5: Schema (ME)
Dry-run first (`READ`):
```
npx tsx migration/migrate.ts --target=production
```
Expected: `[migrate] baseline: 0 tables created from the export (113 would). migrations: 0 applied, 0 already applied, 64 would apply, 0 tolerated`.
After you say **"apply"** (`WRITE`: creates tables only):
```
npx tsx migration/migrate.ts --target=production --apply
npx tsx migration/verify-schema.ts --target=production
```
Expected: `baseline: 113 tables created from the export (0 would). migrations: 64 applied ... N tolerated "already exists"`, then `[verify-schema] schema tables 101, database tables 114; missing tables 0, missing columns 0, extra tables 13, ...`.
**STOP if** `missing tables` or `missing columns` is not 0. **Not a stop:** `extra tables 13` (live tables missing from `schema.ts`) and nullability notes; these match the rehearsal.

### Step 6: Load data (ME)
Dry-run (`READ`):
```
npx tsx migration/load-data.ts --target=production
```
Expected: `[load-data] export has 114 tables, 58 with data, 5467 rows` (the final export's numbers will differ; write down what it prints).
After **"apply"** (`WRITE`; never truncates, and refuses if any table already has rows):
```
npx tsx migration/load-data.ts --target=production --apply
```
Expected: `loaded <N>/<N> rows into <database>; 0 count mismatches, 0 failed tables, 0 tables created from the export's DDL`.
**STOP if** loaded does not equal expected, any mismatch or failed table, or it says `REFUSING: production database is not empty`.

### Step 7: Import members (ME)
Dry-run (`READ`):
```
npx tsx migration/import-users.ts --target=production
```
Expected (Phase 0 data): `11 users: 0 with password, 11 email-only, 0 without email, 0 duplicate email, 0 already imported`. Compare with the number of members you expect.
After **"apply"** (`WRITE`: creates Supabase auth users; moves `users.openId` to the Supabase id and saves the old one in `users.legacyOpenId`):
```
npx tsx migration/import-users.ts --target=production --apply
```
Expected: `created 11, reused 0, failed 0`.
**STOP if** `failed` is not 0 (I report the numeric ids only), or members without an email appear that we did not expect.

### Step 8: Files (ME)
Dry-run (`READ`):
```
npx tsx migration/upload-files.ts --target=production
```
Expected (Phase 0): `15 files (0 public, 15 private), 18.7 MB, 0 without a local source`.
After **"apply"** (`WRITE`: uploads to the private bucket, skips existing):
```
npx tsx migration/upload-files.ts --target=production --apply
npx tsx migration/verify-files.ts --target=production
```
Expected: `uploaded 15, skipped existing 0, failed 0` and `15/15 keys resolve, 0 broken`.
**STOP if** any file failed or is broken.
(`rewrite-urls` is **not** part of the cutover: the API serves `/manus-storage/<key>` itself.)

**STOP/GO for Stages 4 to 8:** all four of: schema has nothing missing, rows loaded = rows exported, members created with 0 failures, 15/15 files resolve. I report the numbers and wait for your go.

### Step 9: Stripe webhook (YOU)
In the Stripe dashboard add an endpoint `https://api.justputzit.com/api/stripe/webhook` for the event `checkout.session.completed` (the only event the app handles). Copy its signing secret (`whsec_...`) into the Railway variable `STRIPE_WEBHOOK_SECRET` and into `.env.production`, then redeploy the API. Keep the Manus endpoint enabled for now.
**GO if** the API redeployed and `curl -s https://<railway-url>/health` returns `{"status":"ok"}`.

### Step 10: DNS (YOU)
Point `justputzit.com` and `www` at Vercel and `api.justputzit.com` at Railway (the exact records your hosts show). Tell me when done and I will watch propagation:
```
nslookup justputzit.com
nslookup api.justputzit.com
curl -sI https://justputzit.com | head -5
curl -s https://api.justputzit.com/health
```
Expected: both names resolve to the new hosts, the site returns `HTTP/2 200`, health returns `{"status":"ok"}`.
**GO if** both resolve from at least two networks/resolvers. Past this point members can reach the new stack (see rollback).

### Step 11: Postflight (ME) `READ`
```
npx tsx migration/postflight.ts
```
Expected: a table of 18 checks, then `Postflight passed: 18/18 checks.` It covers `/health`, public and protected tRPC (protected is refused without a token), the storage redirect, each `/api/scheduled/*` route answering **401** without the secret (a **503** means `CRON_SECRET` is not set on the API), the browser CORS preflight, the site and deep links, manifest, brand image, robots, sitemap, the `/manus-storage` rewrite, and a random sample of up to 50 file keys.
**STOP if** any check fails; a failure banner prints (`Do not announce the cutover; consider rollback`).

### Step 12: Human checks, then signed-in check (YOU, then ME)
YOU: sign in with Google as the admin address and confirm the admin role; open a member's profile photo; request a password reset and confirm the email arrives and the link works; place or inspect one booking if payments are in scope; check the admin panel loads.
ME, after you say **"apply"** for this exact command (`DELETE`: it creates one temporary Supabase account, uses it, then deletes that account and its `users` row):
```
npx tsx migration/postflight.ts --with-test-user
```
Expected: `Postflight passed: 21/21 checks.`; the log line `test user removed: yes`.
**STOP if** any check fails or `test user removed` says the auth user was not removed (I will give you the numeric id to delete by hand).

### Step 13: Cron jobs (YOU + ME)
YOU: create the three Railway cron services (commands and schedules are in `DEPLOY.md` section 4: scrape-events `0 8 * * *`, birthday-reminders `0 14 * * *`, refresh-events `0 */6 * * *`, all UTC, each `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$API_URL/api/scheduled/<job>"`).
ME, after **"apply"** (`WRITE`: runs the jobs once; they scrape public sites and write event data):
```
npx tsx migration/postflight.ts --run-cron
```
Expected: the three `POST ... with secret` checks each `HTTP 200` (each job can take several minutes); `Postflight passed: 21/21 checks.`
**GO if** all three return 200 and a Railway cron run succeeds once.

### Step 14: Announce and hold (YOU)
Announce that the move is complete. In Stripe, **disable the Manus webhook endpoint** (your action). Keep Manus read-only and untouched through the hold week; do not shut it down until we agree in `POSTCUTOVER.md`.

## 4. Quick commands I can run on request (all `READ`)
```
npx tsx migration/preflight.ts
npx tsx migration/postflight.ts
npx tsx migration/verify-files.ts --target=production
npx tsx migration/delta-report.ts --target=production --since=<ISO time>
```
`delta-report` counts member rows created and members signed in on production since a time; it is how we size a rollback.

## 5. Rollback

**Rollback deadline: ____________ (you set it).** After this time we fix forward and do not roll back.

| Situation | Action | Owner |
|---|---|---|
| **R1. Before Step 10 (DNS not changed)** | Nothing changed for members. Lift the Manus freeze. Production data can stay or be cleared; clearing is `DELETE` and needs its own approval, but is not needed (the empty-database check will fail next time, so a retry starts from a fresh database). Re-plan. | YOU |
| **R2. After Step 10, before the deadline** | 1) I run `delta-report --since=<Step 10 time>` so you can see how much member activity would be lost. 2) You decide. 3) Point DNS back at the old Manus records (written down in section 2). 4) Lift the Manus freeze. 5) Leave the Stripe webhook as is (Manus endpoint still enabled until Step 14). 6) Members who signed up or booked on the new stack in the gap must be re-created or re-entered by hand; I can list the counts, not move the rows. | YOU (+ ME for the report) |
| **R3. After Step 14 or after the deadline** | No rollback. Fix forward: patch the new stack, or restore from the TiDB backup. | YOU + ME |

Facts that shape the rollback: Manus keeps its own database and files untouched, so going back loses only what was written to the new stack. Passwords were not migrated (nobody had one), so no credential is stranded on the new side.

## 6. After cutover
I write `migration/POSTCUTOVER.md` (issues seen, member-facing problems, remaining tasks, hold-week monitoring list) once you tell me the cutover is finished.
