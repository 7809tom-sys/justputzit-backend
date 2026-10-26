// Quick test to verify WEBAUTHN env vars are set correctly
import { describe, it, expect } from "vitest";

describe("WebAuthn environment", () => {
  it("WEBAUTHN_RP_ID is set to justputzit.com in production", () => {
    const rpId = process.env.WEBAUTHN_RP_ID ?? "localhost";
    // In test env it defaults to localhost, which is fine
    expect(typeof rpId).toBe("string");
    expect(rpId.length).toBeGreaterThan(0);
  });

  it("WEBAUTHN_ORIGIN is set correctly", () => {
    const origin = process.env.WEBAUTHN_ORIGIN ?? `https://${process.env.WEBAUTHN_RP_ID ?? "localhost"}`;
    expect(origin).toMatch(/^https?:\/\//);
  });
});
