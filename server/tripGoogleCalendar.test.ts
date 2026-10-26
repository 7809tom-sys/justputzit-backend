import { describe, expect, it } from "vitest";
import { buildTripGoogleCalendarUrl } from "../shared/tripGoogleCalendar";

describe("Trip Planner Google Calendar export", () => {
  it("encodes a selected itinerary as a date-bounded Google Calendar event", () => {
    const url = buildTripGoogleCalendarUrl({
      title: "Wisconsin Dells weekend",
      tripDate: "2026-08-15",
      city: "Wisconsin Dells, WI",
      notes: "Pack swimsuits",
      items: [
        { title: "Water park", time: "2026-08-16T10:00", location: "Noah's Ark" },
        { title: "Dinner", time: "2026-08-17T18:00", location: "Downtown" },
      ],
    });
    expect(url).toContain("calendar.google.com/calendar/render");
    expect(url).toContain("text=Wisconsin+Dells+weekend");
    expect(url).toContain("dates=20260815%2F20260818");
    expect(new URL(url ?? "").searchParams.get("details")).toContain("Water park — Noah's Ark");
  });

  it("does not create calendar links for incomplete trip dates or titles", () => {
    expect(buildTripGoogleCalendarUrl({ title: "", tripDate: "2026-08-15" })).toBeNull();
    expect(buildTripGoogleCalendarUrl({ title: "Trip", tripDate: "not-a-date" })).toBeNull();
  });
});
