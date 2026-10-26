import { describe, expect, it } from "vitest";
import { selectCurrentVerifiedEvents } from "./eventRecommendations";

describe("selectCurrentVerifiedEvents", () => {
  const now = new Date("2026-08-11T12:00:00.000Z");

  it("keeps only future linked events the user has not rejected", () => {
    const results = selectCurrentVerifiedEvents([
      { id: 1, eventDate: new Date("2026-08-12T12:00:00.000Z"), externalUrl: "https://example.org/one" },
      { id: 2, eventDate: new Date("2026-08-10T12:00:00.000Z"), externalUrl: "https://example.org/two" },
      { id: 3, eventDate: new Date("2026-08-13T12:00:00.000Z"), externalUrl: null },
      { id: 4, eventDate: new Date("2026-08-14T12:00:00.000Z"), externalUrl: "https://example.org/four" },
    ], new Map([[4, "not_for_me"]]), 3, now);

    expect(results.map((item) => item.id)).toEqual([1]);
  });

  it("honors the recommendation limit in date order", () => {
    const results = selectCurrentVerifiedEvents([
      { id: 1, eventDate: new Date("2026-08-12T12:00:00.000Z"), externalUrl: "https://example.org/one" },
      { id: 2, eventDate: new Date("2026-08-13T12:00:00.000Z"), externalUrl: "https://example.org/two" },
    ], new Map(), 1, now);

    expect(results.map((item) => item.id)).toEqual([1]);
  });
});
