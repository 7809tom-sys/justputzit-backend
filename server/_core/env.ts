/**
 * Environment variables are trimmed and stripped of one pair of surrounding quotes. Hosting dashboards often
 * keep the quotes a person pasted (`"https://..."`), which would otherwise break URLs and issuer checks.
 */
export const cleanEnv = (value: string | undefined): string =>
  (value ?? "").trim().replace(/^(["'])(.*)\1$/s, "$2").trim();

const list = (value: string | undefined) =>
  cleanEnv(value)
    .split(",")
    .map(item => cleanEnv(item))
    .filter(Boolean);

export const ENV = {
  databaseUrl: cleanEnv(process.env.DATABASE_URL),
  isProduction: cleanEnv(process.env.NODE_ENV) === "production",

  // Supabase (Auth + Storage)
  supabaseUrl: cleanEnv(process.env.SUPABASE_URL),
  supabasePublishableKey: cleanEnv(process.env.SUPABASE_PUBLISHABLE_KEY),
  supabaseSecretKey: cleanEnv(process.env.SUPABASE_SECRET_KEY),
  supabaseJwksUrl: cleanEnv(process.env.SUPABASE_JWKS_URL),

  // Gemini (LLM) and MapTiler (geocoding and place search, server-side)
  geminiApiKey: cleanEnv(process.env.GEMINI_API_KEY),
  geminiModel: cleanEnv(process.env.GEMINI_MODEL) || "gemini-3.8-flash",
  maptilerKey: cleanEnv(process.env.MAPTILER_API_KEY),

  // Access control and deployment
  cronSecret: cleanEnv(process.env.CRON_SECRET),
  adminEmails: list(process.env.ADMIN_EMAILS).map(email => email.toLowerCase()),
  corsOrigins: list(process.env.CORS_ORIGINS),
};
