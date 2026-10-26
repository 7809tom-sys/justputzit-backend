import { SignJWT, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeAuthError, logAuthFailure } from "./_core/authLog";
import { ENV } from "./_core/env";
import { verifySupabaseToken } from "./_core/supabaseAuth";

describe("describeAuthError", () => {
  it("names the JWT check that failed and the claim, using real jose errors", async () => {
    ENV.supabaseUrl = "https://project-a.supabase.co";
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const sign = (issuer: string) =>
      new SignJWT({}).setProtectedHeader({ alg: "ES256" }).setIssuer(issuer).setAudience("authenticated").setSubject("u").setExpirationTime("1h").sign(privateKey);

    const wrongIssuer = await verifySupabaseToken(await sign("https://project-b.supabase.co/auth/v1"), publicKey).catch(e => e);
    expect(describeAuthError(wrongIssuer)).toBe("ERR_JWT_CLAIM_VALIDATION_FAILED (claim: iss)");

    const expired = await verifySupabaseToken(
      await new SignJWT({}).setProtectedHeader({ alg: "ES256" }).setIssuer("https://project-a.supabase.co/auth/v1").setAudience("authenticated").setSubject("u").setExpirationTime("-1m").sign(privateKey),
      publicKey,
    ).catch(e => e);
    expect(describeAuthError(expired)).toBe("ERR_JWT_EXPIRED (claim: exp)");

    const other = (await generateKeyPair("ES256")).privateKey;
    const badSignature = await verifySupabaseToken(
      await new SignJWT({}).setProtectedHeader({ alg: "ES256" }).setIssuer("https://project-a.supabase.co/auth/v1").setAudience("authenticated").setSubject("u").setExpirationTime("1h").sign(other),
      publicKey,
    ).catch(e => e);
    expect(describeAuthError(badSignature)).toBe("ERR_JWS_SIGNATURE_VERIFICATION_FAILED");
  });

  it("reports database errors by code only, never by message", () => {
    const dbError = Object.assign(new Error("Duplicate entry 'someone@example.com' for key 'users.email'"), { name: "DrizzleQueryError", cause: { code: "ER_NO_SUCH_TABLE" } });
    expect(describeAuthError(dbError)).toBe("ER_NO_SUCH_TABLE");
    expect(describeAuthError(Object.assign(new Error("connect ECONNREFUSED 10.0.0.1:4000"), { code: "ECONNREFUSED" }))).toBe("ECONNREFUSED");
    expect(describeAuthError(new Error("Duplicate entry 'someone@example.com'"))).toBe("Error");
  });

  it("explains a missing JWKS setting and the app's own refusals", () => {
    expect(describeAuthError(new Error("Auth is not configured: set SUPABASE_JWKS_URL"))).toBe("Auth is not configured: set SUPABASE_JWKS_URL");
    expect(describeAuthError(Object.assign(new Error("This email is already linked to another sign-in"), { name: "ForbiddenError" }))).toBe("This email is already linked to another sign-in");
    expect(describeAuthError(undefined)).toBe("UnknownError");
  });
});

describe("logAuthFailure", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it("logs a given reason once a minute, not on every polling request", () => {
    const error = { code: "ERR_JWT_EXPIRED" };
    const start = 10_000_000;
    expect(logAuthFailure("throttle-test", error, start)).toBe(true);
    expect(logAuthFailure("throttle-test", error, start + 5_000)).toBe(false);
    expect(logAuthFailure("throttle-test", error, start + 61_000)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("[auth] throttle-test: ERR_JWT_EXPIRED");
  });
});
