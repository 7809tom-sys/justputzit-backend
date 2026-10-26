import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env";

export type VerifiedIdentity = {
  /** Supabase user id (JWT `sub`); stored in users.openId. */
  id: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  provider: string | null;
};

type KeySource = CryptoKey | Uint8Array | JWTVerifyGetKey;

let remoteJwks: JWTVerifyGetKey | null = null;

function getRemoteJwks(): JWTVerifyGetKey {
  if (!ENV.supabaseJwksUrl) {
    throw new Error("Auth is not configured: set SUPABASE_JWKS_URL");
  }
  remoteJwks ??= createRemoteJWKSet(new URL(ENV.supabaseJwksUrl));
  return remoteJwks;
}

/** The token issuers we accept: the project in SUPABASE_URL and the project that serves SUPABASE_JWKS_URL. */
export function expectedIssuers(): string[] {
  const hosts = new Set<string>();
  for (const value of [ENV.supabaseUrl, ENV.supabaseJwksUrl]) {
    try {
      if (value) hosts.add(`${new URL(value).origin}/auth/v1`);
    } catch {
      // An unparsable value is reported by the diagnostics endpoint and by verification itself.
    }
  }
  return [...hosts];
}

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Verifies a Supabase access token (signature via JWKS, issuer, audience, expiry)
 * and returns the caller's identity. Throws when the token is not valid.
 * `keySource` exists so tests can verify against a locally generated key.
 */
export async function verifySupabaseToken(
  token: string,
  keySource?: KeySource,
): Promise<VerifiedIdentity> {
  const issuers = expectedIssuers();
  const options = {
    issuer: issuers.length > 0 ? issuers : undefined,
    audience: "authenticated",
  };
  const { payload } = await (keySource
    ? jwtVerify(token, keySource as CryptoKey, options)
    : jwtVerify(token, getRemoteJwks(), options));

  const id = asString(payload.sub);
  if (!id) throw new Error("Token has no subject");

  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;
  return {
    id,
    email: asString(payload.email)?.toLowerCase() ?? null,
    emailVerified: meta.email_verified === true,
    name: asString(meta.full_name) ?? asString(meta.name),
    provider: asString(appMeta.provider),
  };
}

let adminClient: ReturnType<typeof createClient> | null = null;

/** Service-role client; server-side only. */
export function getSupabaseAdmin() {
  if (!ENV.supabaseUrl || !ENV.supabaseSecretKey) {
    throw new Error("Supabase is not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY");
  }
  adminClient ??= createClient(ENV.supabaseUrl, ENV.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}
