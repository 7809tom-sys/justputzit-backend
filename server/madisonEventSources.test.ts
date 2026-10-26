import { describe, expect, it } from "vitest";
import { isLocalMadisonCampusEvent, parseCommunityCalendarDate } from "./communityScraper";

describe("official Madison community calendar parsing", () => {
  const referenceDate = new Date(2026, 7, 14, 9, 0, 0);

  it("parses a public event date with a time and an implied current year", () => {
    const result = parseCommunityCalendarDate("Friday, August 15 · 7:30 PM", referenceDate);
    expect(result).toEqual(new Date(2026, 7, 15, 19, 30, 0));
  });

  it("rolls an already-passed yearless date into the next calendar year", () => {
    const result = parseCommunityCalendarDate("Aug 2 · 10:00 AM", referenceDate);
    expect(result).toEqual(new Date(2027, 7, 2, 10, 0, 0));
  });

  it("rejects date-free content so non-event headings are not published", () => {
    expect(parseCommunityCalendarDate("Coming Up", referenceDate)).toBeNull();
  });

  it("keeps local campus listings while excluding virtual and out-of-area events", () => {
    expect(isLocalMadisonCampusEvent({ id: 1, location: "Memorial Union", latlon: "43.0764,-89.4012" })).toBe(true);
    expect(isLocalMadisonCampusEvent({ id: 2, location: "Online" })).toBe(false);
    expect(isLocalMadisonCampusEvent({ id: 3, location: "Faraway venue", latlon: "44.9765,-93.2650" })).toBe(false);
  });
});
