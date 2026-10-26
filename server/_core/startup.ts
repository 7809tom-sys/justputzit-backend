import type { Server } from "http";

/** Variables the API needs in production. Only NAMES are ever logged, never values. */
export const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_JWKS_URL",
  "SUPABASE_SECRET_KEY",
  "CORS_ORIGINS",
  "CRON_SECRET",
  "ADMIN_EMAILS",
  "GEMINI_API_KEY",
  "MAPTILER_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "RESEND_API_KEY",
  "WEBAUTHN_RP_ID",
  "WEBAUTHN_ORIGIN",
] as const;

type Env = Record<string, string | undefined>;

export const missingEnvNames = (env: Env = process.env): string[] => REQUIRED_IN_PRODUCTION.filter(name => !env[name]?.trim());

/**
 * What the platform logs should say when the service starts, so a wrong port, a development NODE_ENV or a
 * missing CORS origin is visible in the deploy logs instead of showing up later as a browser error.
 */
export function startupReport(port: number, env: Env = process.env): string[] {
  const lines: string[] = [];
  const nodeEnv = env.NODE_ENV ?? "(unset)";
  lines.push(`[startup] listening on port ${port} (NODE_ENV=${nodeEnv}, PORT=${env.PORT ?? "(unset, using default)"})`);

  const origins = (env.CORS_ORIGINS ?? "").split(",").map(o => o.trim()).filter(Boolean);
  lines.push(`[startup] CORS allows ${origins.length} origin(s): ${origins.join(", ") || "(none)"}`);

  const production = nodeEnv === "production";
  if (!production) lines.push(`[startup] WARNING: NODE_ENV is "${nodeEnv}", not "production". Set NODE_ENV=production on the host.`);
  if (production && !origins.some(o => o.startsWith("https://"))) {
    lines.push("[startup] WARNING: CORS_ORIGINS has no https:// origin, so browsers on the deployed site will be blocked.");
  }
  if (origins.some(o => o.startsWith("http://localhost")) && production) {
    lines.push("[startup] WARNING: CORS_ORIGINS contains a localhost origin in production.");
  }
  const missing = missingEnvNames(env);
  if (missing.length > 0) lines.push(`[startup] WARNING: missing environment variables: ${missing.join(", ")}`);
  return lines;
}

export function logStartup(port: number) {
  for (const line of startupReport(port)) (line.includes("WARNING") ? console.warn : console.log)(line);
}

/** Stops accepting connections on SIGTERM/SIGINT and exits once in-flight requests finish (or after `graceMs`). */
export function installShutdownHandlers(server: Server, graceMs = 10_000) {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received, closing the server`);
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => {
      console.warn("[shutdown] grace period over, forcing exit");
      process.exit(0);
    }, graceMs).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
