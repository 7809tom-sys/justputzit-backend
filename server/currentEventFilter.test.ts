import { describe, expect, it } from "vitest";
import { isCurrentOrUpcomingEvent } from "../shared/currentEventFilter";
import { selectCurrentVerifiedEvents } from "./eventRecommendations";

describe("current event filtering", () => {
  const now = new Date("2026-08-14T18:00:00.000Z");

  it("hides an event that has already ended but retains an event currently in progress", () => {
    expect(isCurrentOrUpcomingEvent(new Date("2026-08-13T18:00:00.000Z"), null, now)).toBe(false);
    expect(isCurrentOrUpcomingEvent(new Date("2026-08-14T15:00:00.000Z"), new Date("2026-08-14T20:00:00.000Z"), now)).toBe(true);
  });

  it("keeps Sally suggestions current using the shared filter", () => {
    const events = [
      { id: 1, eventDate: new Date("2026-08-13T18:00:00.000Z"), endDate: null, externalUrl: "https://example.com/past" },
      { id: 2, eventDate: new Date("2026-08-15T18:00:00.000Z"), endDate: null, externalUrl: "https://example.com/future" },
    ];
    expect(selectCurrentVerifiedEvents(events, new Map(), 3, now).map((event) => event.id)).toEqual([2]);
  });
});
