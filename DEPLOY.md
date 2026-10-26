# Deploying Just Putzit (Vercel + Railway + TiDB + Supabase)

| Piece | Platform | What runs there |
|---|---|---|
| Frontend | **Vercel** | The Vite SPA (`pnpm build:web` → `dist/public`) |
| API | **Railway** | Express + tRPC + WebSocket + scheduled jobs (`pnpm build:api`, `pnpm start`) |
| Database | **TiDB Cloud** | MySQL, Drizzle schema unchanged |
| Auth + files | **Supabase** | Auth (email+password, Google) and Storage |
| AI / Maps | **Gemini**, **Google Maps** | Your own API keys |

`.env.example` lists every variable. Never commit a real `.env`.

## 1. Environment variables

### Railway (API)

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` |
| `PORT` | auto | Set by Railway. The server listens on exactly this port. |
| `DATABASE_URL` | yes | `mysql://USER:PASSWORD@HOST:4000/justputzit?ssl={"minVersion":"TLSv1.2","rejectUnauthorized":true}` |
| `SUPABASE_URL` | yes | `https://<project-ref>.supabase.co` |
| `SUPABASE_JWKS_URL` | yes | `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` |
| `SUPABASE_SECRET_KEY` | yes | Service-role / secret key. Server only. |
| `SUPABASE_PUBLISHABLE_KEY` | no | Not used by the API; kept for reference. |
| `GEMINI_API_KEY` | yes | Without it AI features return a friendly "try again" error. |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash`. Google retires models; if calls start returning 404 "no longer available", set this to a current model (`gemini-flash-latest` always points at the newest flash model). |
| `GOOGLE_MAPS_SERVER_KEY` | yes | Geocoding and Places. Restrict by API (not by referrer). |
| `CRON_SECRET` | yes | Long random string. With it unset every `/api/scheduled/*` call is refused (503). |
| `ADMIN_EMAILS` | yes | Comma-separated. Members with a **verified** matching email become admins on sign-in. |
| `CORS_ORIGINS` | yes | Comma-separated browser origins, e.g. `https://justputzit.com,https://www.justputzit.com`. |
| `VITE_SITE_URL` | yes | Public site URL, used in server-built links. |
| `WEBAUTHN_RP_ID` | if passkeys | Bare domain, `justputzit.com`. Must match the site domain. |
| `WEBAUTHN_ORIGIN` | if passkeys | `https://justputzit.com` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | if payments | |
| `RESEND_API_KEY`, `OUTREACH_FROM_EMAIL` | if email | |
| `EVENTBRITE_API_KEY`, `EVENTBRITE_TOKEN`, `MEETUP_API_KEY` | optional | Event crawlers. |
| `CINCH_SEED_ID`, `CINCH_CONNECT_KEY` | optional | Cinch seed integration. |

Railway settings: build `pnpm install --frozen-lockfile && pnpm build:api`, start `pnpm start`, health check path `/health`.

### Vercel (frontend)

Only `VITE_*` values; everything here ends up in the browser, so it must be public.

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Railway public URL, e.g. `https://api.justputzit.com` (no trailing slash). Used for tRPC, uploads and the WebSocket. |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The publishable (anon) key. |
| `VITE_GOOGLE_MAPS_KEY` | Browser key. **Restrict by HTTP referrer** to your domains. |
| `VITE_SITE_URL` | Public site URL. |
| `VITE_ANALYTICS_ENDPOINT`, `VITE_ANALYTICS_WEBSITE_ID` | Optional (Umami). |

`vercel.json` rewrites everything to `index.html`, and proxies `/manus-storage/*`, `/sitemap.xml` and `/robots.txt` to the API.
**Replace `REPLACE-WITH-RAILWAY-DOMAIN` in `vercel.json` with your Railway domain** before the first deploy.

### Supabase (dashboard settings, no env vars)

See sections 2 and 3.

## 2. Supabase

### Storage buckets
| Bucket | Visibility | Holds |
|---|---|---|
| `site-public` | public | Generated images and other non-member files |
| `member-private` | private | `profile-photos/…` and `voice/…`; served via 1-hour signed URLs |

Both exist in project `grjlqbypmrjusteyocsp` and hold the migrated files (6 public, 15 private). Static brand images are not in Storage; they ship with the frontend under `client/public/brand/`.
The temporary buckets `justputzit` and `member-uploads` were deleted after their files were verified in the new buckets. A separate older bucket named `profile-photos` (public, created in June, not part of this migration) is untouched.

### Auth configuration
1. **Authentication → Providers → Email**: enabled, and **Confirm email must be ON**. The API links an existing member to a Supabase account by *verified* email; with confirmation off, anyone could claim someone else's address.
2. **Authentication → Providers → Google**: enable, paste the Google client ID and secret (section 3).
3. **Authentication → URL Configuration**
   - Site URL: `https://justputzit.com`
   - Redirect URLs (**required for password reset**; if `/reset-password` is not covered, Supabase sends the reset link to the Site URL instead): `https://justputzit.com/**`, `https://www.justputzit.com/**`, your Vercel preview pattern (e.g. `https://*-yourteam.vercel.app/**`), and `http://localhost:5173/**` for development.
4. **Authentication → Policies**: set the minimum password length to **8** to match the sign-up and reset forms.
5. **Authentication → Settings**: use the project's JWT signing keys (asymmetric). The API verifies tokens against the JWKS URL.
6. Production email: configure custom SMTP (for example Resend) so confirmation and reset emails are reliably delivered.

### How existing members keep their data
`users.openId` now holds the Supabase user id. The first time a member signs in, the API finds their old row by **verified email** and repoints it to the new id, so bookings, profile and photos carry over. A member who signs up with the same email unverified is *not* linked and has no email stored until confirmed.

Of the 11 imported members (7 Google, 3 Apple, 1 unknown): Google members just use "Continue with Google". Apple sign-in is not offered, so the 3 Apple members and the 1 unknown member use **Forgot password** on the login page with the email on their account; that creates their Supabase password and signs them in. They can also use Google if it is the same email.

### Password reset
`/login` has a "Forgot password?" link to `/forgot-password`, which emails a link to `/reset-password` where the member picks a new password. The form always shows the same confirmation, whether or not the address has an account. Links work once and expire.

## 3. Google OAuth (sign-in) and Maps

In Google Cloud Console → APIs & Services → Credentials:

1. Create an **OAuth client ID** of type *Web application*.
   - **Authorized redirect URI:** `https://<project-ref>.supabase.co/auth/v1/callback`
   - **Authorized JavaScript origins:** `https://justputzit.com`, `https://www.justputzit.com`, `http://localhost:5173`
2. Put the client ID and secret into Supabase → Providers → Google.
3. Consent screen: add `justputzit.com` as an authorized domain and publish the app.
4. Maps: create two keys. Server key (`GOOGLE_MAPS_SERVER_KEY`) restricted to Geocoding API and Places API. Browser key (`VITE_GOOGLE_MAPS_KEY`) restricted by HTTP referrer, with Maps JavaScript API and Places enabled.

## 4. Scheduled jobs (Railway cron)

The API exposes three endpoints. Each needs `Authorization: Bearer $CRON_SECRET`.

| Endpoint | What it does | Suggested schedule (UTC) |
|---|---|---|
| `POST /api/scheduled/scrape-events` | Scrapes Milwaukee/Waukesha, Madison and La Crosse event sources into the database | `0 8 * * *` (nightly) |
| `POST /api/scheduled/birthday-reminders` | Once-daily private birthday match notifications | `0 14 * * *` (daily) |
| `POST /api/scheduled/refresh-events` | Crawls city sources, purges old events, reseeds thin cities | `0 */6 * * *` (every 6 hours) |

These schedules are confirmed. (The original Manus schedules were not in the repository; the handlers only describe them as nightly, once-daily and every 6 hours.)

Set up one Railway **cron service** per job (Railway cron services run a command on a schedule and must exit):

1. New service from the same repo, or an empty service with a Docker image such as `curlimages/curl`.
2. Variables: `CRON_SECRET` (same value as the API) and `API_URL` (the API's public URL).
3. Settings → Cron Schedule: one of the schedules above.
4. Start command:
   ```
   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "$API_URL/api/scheduled/refresh-events"
   ```
   Replace the path for the other two jobs. `-f` makes the job fail visibly on 401/5xx.

Test once by hand:
```
curl -i -X POST -H "Authorization: Bearer $CRON_SECRET" "$API_URL/api/scheduled/birthday-reminders"
```
A call without the header must return 401.

## 5. Go-live checklist
1. Railway: set variables, deploy, confirm `GET /health` returns `{"status":"ok"}`.
2. Replace the placeholder domain in `vercel.json`; set Vercel variables; deploy.
3. Add the Vercel/custom domain to `CORS_ORIGINS` and to Supabase redirect URLs.
4. Sign in with Google as an admin email; confirm the admin role.
5. Open a member's profile photo (signed URL) and send a test upload.
6. Trigger each cron endpoint once.
7. If using passkeys, set `WEBAUTHN_RP_ID` to the production domain and re-test.
