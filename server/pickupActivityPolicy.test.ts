import { describe, expect, it } from "vitest";
import { getPickupSafetyError, isPickupPreferenceMatch, pickupTemplate, selectSimilarActivities } from "../shared/pickupActivityPolicy";

describe("pickup activity policy", () => {
  it("requires a future public-venue pickup with a safe group size", () => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    expect(getPickupSafetyError({ startAt: start, capacity: 10, venueName: "Waukesha YMCA", city: "Waukesha" })).toBeNull();
    expect(getPickupSafetyError({ startAt: start, capacity: 21, venueName: "Waukesha YMCA", city: "Waukesha" })).toContain("2 to 20");
  });

  it("matches bowling and sports preferences without exposing profile details", () => {
    expect(isPickupPreferenceMatch("bowling_singles", ["bowling"])).toBe(true);
    expect(isPickupPreferenceMatch("basketball", ["sports"])).toBe(true);
    expect(isPickupPreferenceMatch("basketball", ["arts"])).toBe(false);
  });

  it("uses clear public-venue templates for basketball and singles bowling", () => {
    expect(pickupTemplate("basketball").title).toContain("basketball");
    expect(pickupTemplate("bowling_singles").title).toContain("Singles Mixer");
  });

  it("uses saved sports signals to prioritize similar local activities", () => {
    const activities = [{ category: "arts", id: 1 }, { category: "basketball", id: 2 }, { category: "bowling", id: 3 }];
    expect(selectSimilarActivities(activities, ["sports"]).map((item) => item.id)).toEqual([2]);
  });
});
