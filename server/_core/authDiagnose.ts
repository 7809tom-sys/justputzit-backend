import type { Request, Response } from "express";
import { decodeJwt } from "jose";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { resolveUser } from "./auth";
import { describeAuthError } from "./authLog";
import { ENV } from "./env";
import { expectedIssuers, verifySupabaseToken } from "./supabaseAuth";

/** A plain-language next step for each failure code the diagnostics can return. */
export function hintFor(code: string): string {
  if (code.startsWith("ERR_JWT_CLAIM_VALIDATION_FAILED (claim: iss)")) {
    return "The token was issued by a different Supabase project than the one SUPABASE_URL / SUPABASE_JWKS_URL point at. Compare tokenIssuerHost with expectedIssuerHosts and fix the variables on the API host.";
  }
  if (code.startsWith("ERR_JWT_CLAIM_VALIDATION_FAILED (claim: aud)")) return "The token is not a signed-in user session (wrong audience). Send the access_token of a signed-in user.";
  if (code === "ERR_JWT_EXPIRED (claim: exp)") return "The token has expired. Sign in again and retry.";
  if (code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED" || code === "ERR_JWKS_NO_MATCHING_KEY") {
    return "The signature does not match the keys at SUPABASE_JWKS_URL. The URL points at a different project than the one that issued the token.";
  }
  if (code.startsWith("ERR_JWKS") || code === "ECONNREFUSED" || code === "ENOTFOUND") return "The API host could not fetch the signing keys. Check SUPABASE_JWKS_URL and the host's outbound network access.";
  if (code.startsWith("Auth is not configured")) return "SUPABASE_JWKS_URL is not set on the API host.";
  if (code === "ER_NO_SUCH_TABLE") return "The database the API uses has no tables. Load the schema and data into that database, or point DATABASE_URL at the right one.";
  if (code === "ER_ACCESS_DENIED_ERROR" || code === "ER_DBACCESS_DENIED_ERROR") return "The database refused the credentials in DATABASE_URL.";
  if (code === "ER_BAD_FIELD_ERROR") return "The database is missing a column the app expects, so it is older than this version of the app. Apply the pending migrations in drizzle/ to that database (migration/migrate.ts --apply).";
  if (code === "ER_BAD_DB_ERROR") return "The database named in DATABASE_URL does not exist.";
  if (code.startsWith("ERR_JWT_INVALID") || code === "ERR_JWS_INVALID") return "That is not a valid session token. Copy the access_token of a signed-in user.";
  return "";
}

const hostOf = (value: string | undefined): string | undefined => {
  try {
    return value ? new URL(value).host : undefined;
  } catch {
    return undefined;
  }
};

async function checkJwks() {
  if (!ENV.supabaseJwksUrl) return { configured: false as const };
  const host = hostOf(ENV.supabaseJwksUrl);
  try {
    const response = await fetch(ENV.supabaseJwksUrl, { signal: AbortSignal.timeout(5_000) });
    const body = (await response.json().catch(() => ({}))) as { keys?: unknown[] };
    return { configured: true as const, host, status: response.status, keys: Array.isArray(body.keys) ? body.keys.length : 0 };
  } catch (error) {
    return { configured: true as const, host, error: describeAuthError(error) };
  }
}

async function checkDatabase() {
  if (!ENV.databaseUrl) return { configured: false as const };
  try {
    const db = await getDb();
    if (!db) return { configured: true as const, ok: false, error: "no connection" };
    await db.execute(sql`SELECT 1`);
    return { configured: true as const, ok: true };
  } catch (error) {
    return { configured: true as const, ok: false, error: describeAuthError(error) };
  }
}

/**
 * GET /api/auth/diagnose with `Authorization: Bearer <access_token>`.
 * Says which stage rejects a sign-in (token check, signing keys, database, member creation) and why. Returns only
 * error codes and public host names, never the token or any value from the database. Like any first sign-in, a
 * valid token for a new member creates that member.
 */
export async function diagnoseAuth(req: Request, res: Response) {
  const header = req.headers.authorization ?? "";
  const token = /^Bearer\s+(.+)$/i.exec(header.trim())?.[1]?.trim();
  if (!token) {
    res.status(400).json({ error: "Send the session token as 'Authorization: Bearer <access_token>'." });
    return;
  }

  let tokenIssuerHost: string | undefined;
  try {
    tokenIssuerHost = hostOf(String(decodeJwt(token).iss ?? ""));
  } catch {
    // Reported as an invalid token below.
  }

  const base = {
    tokenIssuerHost,
    expectedIssuerHosts: expectedIssuers().map(hostOf),
    jwks: await checkJwks(),
    database: await checkDatabase(),
  };

  let identity;
  try {
    identity = await verifySupabaseToken(token);
  } catch (error) {
    const problem = describeAuthError(error);
    res.json({ stage: "token", ok: false, problem, hint: hintFor(problem), ...base });
    return;
  }

  try {
    const user = await resolveUser(identity);
    res.json({ stage: "ok", ok: true, role: user.role, ...base });
  } catch (error) {
    const problem = describeAuthError(error);
    res.json({ stage: "member", ok: false, problem, hint: hintFor(problem), ...base });
  }
}
