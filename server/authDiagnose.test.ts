import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  resolveUser: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("./_core/supabaseAuth", async importOriginal => ({
  ...(await importOriginal<typeof import("./_core/supabaseAuth")>()),
  verifySupabaseToken: mocks.verify,
}));
vi.mock("./_core/auth", () => ({ resolveUser: mocks.resolveUser }));
vi.mock("./db", () => ({ getDb: async () => ({ execute: mocks.execute }) }));

import { diagnoseAuth, hintFor } from "./_core/authDiagnose";
import { cleanEnv, ENV } from "./_core/env";
import { expectedIssuers } from "./_core/supabaseAuth";

// A token whose (unverified) payload names a project, like a real Supabase access token.
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const tokenFor = (issuer: string) => `${b64({ alg: "ES256" })}.${b64({ iss: issuer, sub: "u" })}.signature-not-checked-here`;

function run(authorization?: string) {
  const out: { status: number; body: any } = { status: 200, body: null };
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: unknown) {
      out.body = body;
      return res;
    },
  };
  return diagnoseAuth({ headers: authorization ? { authorization } : {} } as any, res).then(() => out);
}

describe("auth diagnostics endpoint", () => {
  beforeEach(() => {
    ENV.supabaseUrl = "https://project-a.supabase.co";
    ENV.supabaseJwksUrl = "https://project-a.supabase.co/auth/v1/.well-known/jwks.json";
    ENV.databaseUrl = "mysql://user:pw@host:4000/db";
    mocks.verify.mockReset();
    mocks.resolveUser.mockReset();
    mocks.execute.mockReset().mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ keys: [{}, {}] }), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks for a token when none is sent", async () => {
    const result = await run();
    expect(result.status).toBe(400);
    expect(result.body.error).toContain("Authorization: Bearer");
  });

  it("names a different Supabase project as the cause, and never echoes the token", async () => {
    const token = tokenFor("https://project-b.supabase.co/auth/v1");
    mocks.verify.mockRejectedValue(Object.assign(new Error("unexpected iss"), { code: "ERR_JWT_CLAIM_VALIDATION_FAILED", claim: "iss" }));
    const { body } = await run(`Bearer ${token}`);

    expect(body).toMatchObject({
      stage: "token",
      ok: false,
      problem: "ERR_JWT_CLAIM_VALIDATION_FAILED (claim: iss)",
      tokenIssuerHost: "project-b.supabase.co",
      expectedIssuerHosts: ["project-a.supabase.co"],
      jwks: { configured: true, host: "project-a.supabase.co", status: 200, keys: 2 },
      database: { configured: true, ok: true },
    });
    expect(body.hint).toContain("different Supabase project");
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it("reports a database problem by code, after the token itself was accepted", async () => {
    mocks.verify.mockResolvedValue({ id: "u", email: "a@example.com", emailVerified: true, name: null, provider: "google" });
    mocks.resolveUser.mockRejectedValue(Object.assign(new Error("Table 'db.users' doesn't exist"), { name: "DrizzleQueryError", cause: { code: "ER_NO_SUCH_TABLE" } }));
    mocks.execute.mockRejectedValue(Object.assign(new Error("boom"), { code: "ER_NO_SUCH_TABLE" }));
    const { body } = await run(`Bearer ${tokenFor("https://project-a.supabase.co/auth/v1")}`);

    expect(body).toMatchObject({ stage: "member", ok: false, problem: "ER_NO_SUCH_TABLE", database: { ok: false, error: "ER_NO_SUCH_TABLE" } });
    expect(body.hint).toContain("no tables");
    expect(JSON.stringify(body)).not.toContain("doesn't exist");
    expect(JSON.stringify(body)).not.toContain("a@example.com");
  });

  it("returns ok with the member's role when everything works", async () => {
    mocks.verify.mockResolvedValue({ id: "u", email: null, emailVerified: false, name: null, provider: null });
    mocks.resolveUser.mockResolvedValue({ id: 5, role: "user" });
    const { body } = await run(`Bearer ${tokenFor("https://project-a.supabase.co/auth/v1")}`);
    expect(body).toMatchObject({ stage: "ok", ok: true, role: "user" });
  });

  it("explains when the signing keys cannot be fetched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { code: "ENOTFOUND" }); }));
    mocks.verify.mockRejectedValue(Object.assign(new Error("x"), { code: "ERR_JWKS_TIMEOUT" }));
    const { body } = await run(`Bearer ${tokenFor("https://project-a.supabase.co/auth/v1")}`);
    expect(body.jwks).toMatchObject({ configured: true, error: "ENOTFOUND" });
    expect(body.hint).toContain("signing keys");
  });
});

describe("hints", () => {
  it("covers the common causes", () => {
    expect(hintFor("ERR_JWT_EXPIRED (claim: exp)")).toContain("expired");
    expect(hintFor("ERR_JWS_SIGNATURE_VERIFICATION_FAILED")).toContain("SUPABASE_JWKS_URL");
    expect(hintFor("Auth is not configured: set SUPABASE_JWKS_URL")).toContain("not set");
    expect(hintFor("ER_BAD_DB_ERROR")).toContain("does not exist");
    expect(hintFor("ER_BAD_FIELD_ERROR")).toContain("missing a column");
    expect(hintFor("SomethingElse")).toBe("");
  });
});

describe("environment cleaning and issuers", () => {
  it("strips whitespace and one pair of surrounding quotes", () => {
    expect(cleanEnv('  "https://a.supabase.co"  ')).toBe("https://a.supabase.co");
    expect(cleanEnv("'x'")).toBe("x");
    expect(cleanEnv("https://a.supabase.co/")).toBe("https://a.supabase.co/");
    expect(cleanEnv(undefined)).toBe("");
  });

  it("accepts the project named by either the Supabase URL or the JWKS URL, ignoring any path", () => {
    ENV.supabaseUrl = "https://project-a.supabase.co/";
    ENV.supabaseJwksUrl = "https://project-b.supabase.co/auth/v1/.well-known/jwks.json";
    expect(expectedIssuers()).toEqual(["https://project-a.supabase.co/auth/v1", "https://project-b.supabase.co/auth/v1"]);
    ENV.supabaseUrl = "";
    ENV.supabaseJwksUrl = "not a url";
    expect(expectedIssuers()).toEqual([]);
  });
});
