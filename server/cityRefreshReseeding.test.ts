import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CITY_RESEED_MIN_UPCOMING_EVENTS, shouldReseedCity } from "../shared/cityRefreshPolicy";

describe("city refresh reseeding", () => {
  it("reseeds only cities below the upcoming-event threshold", () => {
    expect(shouldReseedCity(CITY_RESEED_MIN_UPCOMING_EVENTS - 1)).toBe(true);
    expect(shouldReseedCity(CITY_RESEED_MIN_UPCOMING_EVENTS)).toBe(false);
    expect(shouldReseedCity(CITY_RESEED_MIN_UPCOMING_EVENTS + 8)).toBe(false);
  });

  it("keeps the scheduled upcoming-event count scoped to each seeded city", () => {
    const source = readFileSync(resolve(__dirname, "handlers/refreshEvents.ts"), "utf8");
    expect(source).toContain("eq(communityEvents.city, cityRow.city)");
    expect(source).toContain("shouldReseedCity(Number(cnt ?? 0))");
  });
});
