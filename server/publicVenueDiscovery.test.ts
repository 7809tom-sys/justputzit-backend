import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPublicVenueSearchPlan, getCuratedPublicSeedsForCity, normalizeDiscoveryCity, PUBLIC_ACTIVITY_CATEGORIES } from "./publicVenueDiscovery";

describe("public venue discovery", () => {
  it("covers every requested public recreation category", () => {
    expect(PUBLIC_ACTIVITY_CATEGORIES).toEqual(expect.arrayContaining([
      "swimming_pool", "beach", "dirt_track", "basketball", "ymca", "public_gym",
      "golf", "disc_golf", "volleyball", "tennis",
    ]));
  });

  it("keeps Waukesha curated public recreation venues separate from Milwaukee", () => {
    const waukesha = getCuratedPublicSeedsForCity("Waukesha, WI");
    const milwaukee = getCuratedPublicSeedsForCity("Milwaukee, WI");

    expect(waukesha.length).toBeGreaterThanOrEqual(4);
    expect(waukesha.some((seed) => seed.venueName === "Buchner Park Community Pool")).toBe(true);
    expect(waukesha.some((seed) => seed.venueName === "Minooka Park Beach")).toBe(true);
    expect(waukesha.every((seed) => seed.city === "Waukesha" && seed.state === "WI")).toBe(true);
    expect(milwaukee.some((seed) => seed.venueName === "Buchner Park Community Pool")).toBe(false);
  });

  it("includes verified Madison municipal pool and recreation-center coverage", () => {
    const madison = getCuratedPublicSeedsForCity("Madison, WI");

    expect(madison).toEqual(expect.arrayContaining([
      expect.objectContaining({ venueName: "Irwin A. and Robert D. Goodman Pool", category: "swimming_pool" }),
      expect.objectContaining({ venueName: "Warner Park Community Recreation Center", category: "public_gym" }),
    ]));
    expect(madison.every((seed) => seed.city === "Madison" && seed.state === "WI")).toBe(true);
  });

  it("builds a city-specific search plan for any US city", () => {
    const plan = buildPublicVenueSearchPlan("Oklahoma City", "OK");
    expect(plan).toHaveLength(PUBLIC_ACTIVITY_CATEGORIES.length);
    expect(plan.find((item) => item.category === "golf")?.query).toContain("Oklahoma City, OK");
  });

  it("removes a state suffix from a saved city label", () => {
    expect(normalizeDiscoveryCity("Madison, WI")).toBe("Madison");
  });

  it("deduplicates public activities by venue and category instead of generated title", () => {
    const source = readFileSync(resolve(__dirname, "publicVenueDiscovery.ts"), "utf8");
    expect(source).toContain("eq(activityListings.venueId, venueId), eq(activityListings.category, seed.category)");
    expect(source).not.toContain("eq(activityListings.venueId, venueId), eq(activityListings.title, seed.title)");
  });
});
