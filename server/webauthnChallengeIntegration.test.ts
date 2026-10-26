import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("durable WebAuthn challenge integration", () => {
  it("uses durable store and consume helpers instead of an in-memory challenge map", () => {
    const root = resolve(__dirname, "..");
    const router = readFileSync(resolve(root, "server/routers.ts"), "utf8");
    const db = readFileSync(resolve(root, "server/db.ts"), "utf8");
    expect(router).toContain("storeWebAuthnChallenge");
    expect(router).toContain("consumeWebAuthnChallenge");
    expect(router).not.toContain("passkeyChallengeTempStore");
    expect(db).toContain("webauthnChallenges");
  });
});
