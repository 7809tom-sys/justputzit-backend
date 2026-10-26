import { describe, expect, it } from "vitest";
import { parseUWMArtsCalendarEvents } from "./communityScraper";

describe("UW–Milwaukee Peck School of the Arts calendar", () => {
  const now = new Date("2026-08-14T12:00:00");

  it("normalizes official future arts events with campus location and source details", () => {
    const events = parseUWMArtsCalendarEvents([{
      id: 1,
      title: "New Play Reading &#8211; Gloria",
      description: "<p>An <strong>official</strong> theatre event.</p>",
      url: "https://uwm.edu/arts/event/new-play-reading/",
      start_date: "2026-08-23 19:00:00",
      end_date: "2026-08-23 22:00:00",
      cost: "Free",
      venue: { venue: "Theatre Building", address: "2400 E Kenwood Blvd", city: "Milwaukee" },
    }], now);

    expect(events).toEqual([expect.objectContaining({
      title: "New Play Reading – Gloria",
      category: "arts",
      venueName: "Theatre Building",
      venueCity: "Milwaukee, WI",
      sourceName: "UW–Milwaukee Peck School of the Arts",
      isFree: true,
      isOnCampus: true,
    })]);
  });

  it("does not keep past or invalid official calendar entries", () => {
    const events = parseUWMArtsCalendarEvents([
      { id: 1, title: "Past concert", start_date: "2026-08-01 19:00:00" },
      { id: 2, title: "Missing date" },
    ], now);
    expect(events).toEqual([]);
  });
});
