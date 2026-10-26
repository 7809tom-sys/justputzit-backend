import { describe, expect, it } from "vitest";
import { parseWaukeshaCalendarDate } from "./communityScraper";

describe("Waukesha Public Library calendar dates", () => {
  it("parses the official calendar’s month, day, year, and time fields", () => {
    const date = parseWaukeshaCalendarDate("Aug", "18", "2026", "6:00pm–7:00pm");
    expect(date?.toISOString()).toContain("2026-08-18T18:00:00.000Z");
  });

  it("returns null instead of fabricating a date when calendar fields are incomplete", () => {
    expect(parseWaukeshaCalendarDate("", "18", "2026", "6:00pm")).toBeNull();
  });
});
