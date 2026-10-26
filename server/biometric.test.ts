import { describe, it, expect } from "vitest";
import {
  getPasskeysForUser,
  getPasskeyByCredentialId,
  getActiveLoginAd,
  getLoginAdsForVendor,
} from "./db";

describe("passkey credentials", () => {
  it("getPasskeysForUser returns empty array for unknown user", async () => {
    const result = await getPasskeysForUser(999999);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getPasskeyByCredentialId returns null for unknown credential", async () => {
    const result = await getPasskeyByCredentialId("nonexistent-credential-id");
    expect(result).toBeNull();
  });
});

describe("login ads", () => {
  it("getActiveLoginAd returns null or an ad object", async () => {
    const result = await getActiveLoginAd();
    if (result !== null) {
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("videoUrl");
      expect(result.isActive).toBe(true);
    } else {
      expect(result).toBeNull();
    }
  });

  it("getLoginAdsForVendor returns empty array for unknown vendor", async () => {
    const result = await getLoginAdsForVendor(999999);
    expect(Array.isArray(result)).toBe(true);
  });
});
