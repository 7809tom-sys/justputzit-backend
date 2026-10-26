import { describe, expect, it } from "vitest";
import { canAccessMarketplaceCheckoutSession } from "./stripeCheckout";

describe("Stripe payment confirmation access", () => {
  it("allows the member identified by both secure Checkout fields", () => {
    expect(canAccessMarketplaceCheckoutSession({
      clientReferenceId: "42",
      metadataUserId: "42",
    }, 42)).toBe(true);
  });

  it("rejects a session when either owner identifier does not match", () => {
    expect(canAccessMarketplaceCheckoutSession({
      clientReferenceId: "42",
      metadataUserId: "7",
    }, 42)).toBe(false);
    expect(canAccessMarketplaceCheckoutSession({
      clientReferenceId: "7",
      metadataUserId: "42",
    }, 42)).toBe(false);
    expect(canAccessMarketplaceCheckoutSession({
      clientReferenceId: null,
      metadataUserId: null,
    }, 42)).toBe(false);
  });
});
