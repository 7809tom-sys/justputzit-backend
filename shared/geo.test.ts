import { describe, expect, it } from "vitest";
import { formatMilesAway, haversineDistanceMiles } from "./geo";

describe("geographic discovery helpers", () => {
  it("calculates the Milwaukee-to-Waukesha distance in miles", () => {
    const miles = haversineDistanceMiles(43.0389, -87.9065, 43.0117, -88.2315);
    expect(miles).toBeGreaterThan(15);
    expect(miles).toBeLessThan(20);
  });

  it("formats nearby and longer distances for cards", () => {
    expect(formatMilesAway(0.04)).toBe("Less than 0.1 mi away");
    expect(formatMilesAway(4.6)).toBe("4.6 mi away");
    expect(formatMilesAway(18.4)).toBe("18 mi away");
    expect(formatMilesAway(null)).toBe("Distance unavailable");
  });
});
