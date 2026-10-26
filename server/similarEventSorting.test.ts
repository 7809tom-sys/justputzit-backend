import { describe, expect, it } from "vitest";
import { sortSimilarEvents } from "../shared/similarEventSorting";

const events = [
  { id: 1, eventDate: "2026-08-20T18:00:00.000Z", distanceMiles: 9 },
  { id: 2, eventDate: "2026-08-15T18:00:00.000Z", distanceMiles: 3 },
  { id: 3, eventDate: null, distanceMiles: null },
];

describe("similar event sorting", () => {
  it("preserves personalized order and supports stable date and distance sorting", () => {
    expect(sortSimilarEvents(events, "personalized").map((event) => event.id)).toEqual([1, 2, 3]);
    expect(sortSimilarEvents(events, "date").map((event) => event.id)).toEqual([2, 1, 3]);
    expect(sortSimilarEvents(events, "distance").map((event) => event.id)).toEqual([2, 1, 3]);
  });
});
