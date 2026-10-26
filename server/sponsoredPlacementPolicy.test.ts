import { describe, expect, it } from "vitest";
import { getSponsoredPlacementEligibility, getSponsoredPlacementPackage, isActiveSponsoredPlacement } from "../shared/sponsoredPlacementPolicy";

describe("sponsored placement policy", () => {
  it("uses transparent seven and thirty day packages", () => {
    expect(getSponsoredPlacementPackage("week")).toMatchObject({ amountCents: 9900, durationDays: 7 });
    expect(getSponsoredPlacementPackage("month")).toMatchObject({ amountCents: 24900, durationDays: 30 });
  });

  it("requires an active business activity but does not block member-facing paid venues", () => {
    expect(getSponsoredPlacementEligibility({ listingIsActive: false, listingIsPublicAccess: true, venueIsPublicAccess: true })).toMatch(/active/i);
    expect(getSponsoredPlacementEligibility({ listingIsActive: true, listingIsPublicAccess: false, venueIsPublicAccess: false })).toBeNull();
    expect(getSponsoredPlacementEligibility({ listingIsActive: true, listingIsPublicAccess: false, venueIsPublicAccess: true })).toBeNull();
  });

  it("only treats placements with a future end time as active", () => {
    const now = new Date("2026-08-13T12:00:00Z");
    expect(isActiveSponsoredPlacement({ status: "active", endsAt: new Date("2026-08-14T12:00:00Z") }, now)).toBe(true);
    expect(isActiveSponsoredPlacement({ status: "active", endsAt: new Date("2026-08-12T12:00:00Z") }, now)).toBe(false);
    expect(isActiveSponsoredPlacement({ status: "checkout_pending", endsAt: new Date("2026-08-14T12:00:00Z") }, now)).toBe(false);
  });
});
