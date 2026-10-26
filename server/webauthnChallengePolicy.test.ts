import { describe, expect, it } from "vitest";
import { getWebauthnChallengeExpiry, isUsableWebauthnChallenge, WEBAUTHN_CHALLENGE_TTL_MS } from "../shared/webauthnChallengePolicy";

describe("WebAuthn challenge policy", () => {
  it("expires challenges after five minutes and rejects consumed challenges", () => {
    const now = new Date("2026-08-14T12:00:00.000Z");
    const expiresAt = getWebauthnChallengeExpiry(now);
    expect(expiresAt.getTime() - now.getTime()).toBe(WEBAUTHN_CHALLENGE_TTL_MS);
    expect(isUsableWebauthnChallenge({ expiresAt, consumedAt: null }, now)).toBe(true);
    expect(isUsableWebauthnChallenge({ expiresAt, consumedAt: new Date(now) }, now)).toBe(false);
    expect(isUsableWebauthnChallenge({ expiresAt, consumedAt: null }, expiresAt)).toBe(false);
  });
});
