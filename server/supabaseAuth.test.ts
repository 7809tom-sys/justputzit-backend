import { SignJWT, generateKeyPair } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { verifySupabaseToken } from "./_core/supabaseAuth";

const SUPABASE_URL = "https://example-project.supabase.co";
const ISSUER = `${SUPABASE_URL}/auth/v1`;

let privateKey: CryptoKey;
let publicKey: CryptoKey;
let otherPrivateKey: CryptoKey;

async function sign(
  claims: Record<string, unknown> = {},
  opts: { key?: CryptoKey; issuer?: string; audience?: string; expiresIn?: string; sub?: string | null } = {},
) {
  const jwt = new SignJWT({
    email: "Member@Example.com",
    user_metadata: { email_verified: true, full_name: "Member One" },
    app_metadata: { provider: "google" },
    ...claims,
  })
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(opts.issuer ?? ISSUER)
    .setAudience(opts.audience ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? "1h");
  if (opts.sub !== null) jwt.setSubject(opts.sub ?? "11111111-1111-1111-1111-111111111111");
  return jwt.sign(opts.key ?? privateKey);
}

describe("verifySupabaseToken", () => {
  beforeAll(async () => {
    ({ privateKey, publicKey } = await generateKeyPair("ES256"));
    ({ privateKey: otherPrivateKey } = await generateKeyPair("ES256"));
  });
  beforeEach(() => {
    ENV.supabaseUrl = SUPABASE_URL;
  });

  it("accepts a valid token and maps the identity", async () => {
    const identity = await verifySupabaseToken(await sign(), publicKey);
    expect(identity).toEqual({
      id: "11111111-1111-1111-1111-111111111111",
      email: "member@example.com",
      emailVerified: true,
      name: "Member One",
      provider: "google",
    });
  });

  it("reports an unverified email as unverified", async () => {
    const token = await sign({ user_metadata: { email_verified: false } });
    expect((await verifySupabaseToken(token, publicKey)).emailVerified).toBe(false);
  });

  it("rejects a token signed with a different key", async () => {
    await expect(verifySupabaseToken(await sign({}, { key: otherPrivateKey }), publicKey)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    await expect(verifySupabaseToken(await sign({}, { expiresIn: "-1m" }), publicKey)).rejects.toThrow();
  });

  it("rejects a token from another issuer", async () => {
    const token = await sign({}, { issuer: "https://evil.example.com/auth/v1" });
    await expect(verifySupabaseToken(token, publicKey)).rejects.toThrow();
  });

  it("rejects a token with the wrong audience", async () => {
    await expect(verifySupabaseToken(await sign({}, { audience: "anon" }), publicKey)).rejects.toThrow();
  });

  it("rejects a token without a subject", async () => {
    await expect(verifySupabaseToken(await sign({}, { sub: null }), publicKey)).rejects.toThrow();
  });

  it("rejects garbage", async () => {
    await expect(verifySupabaseToken("not-a-jwt", publicKey)).rejects.toThrow();
  });
});
