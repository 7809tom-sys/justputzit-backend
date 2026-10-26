const list = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

export const ENV = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",

  // Supabase (Auth + Storage)
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  supabaseJwksUrl: process.env.SUPABASE_JWKS_URL ?? "",

  // Gemini (LLM) and MapTiler (geocoding and place search, server-side)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  maptilerKey: process.env.MAPTILER_API_KEY ?? "",

  // Access control and deployment
  cronSecret: process.env.CRON_SECRET ?? "",
  adminEmails: list(process.env.ADMIN_EMAILS).map(email => email.toLowerCase()),
  corsOrigins: list(process.env.CORS_ORIGINS),
};
