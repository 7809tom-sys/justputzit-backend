import { describe, expect, it } from "vitest";
import { filterSimilarEventsByCategory } from "../shared/similarEventCategoryFilter";

const events = [
  { id: 1, category: "library" },
  { id: 2, category: "hiking" },
  { id: 3, category: "bowling" },
  { id: 4, category: "arts" },
];

describe("similar event category filtering", () => {
  it("keeps all events or returns the matching high-level activity types", () => {
    expect(filterSimilarEventsByCategory(events, "all").map((event) => event.id)).toEqual([1, 2, 3, 4]);
    expect(filterSimilarEventsByCategory(events, "family").map((event) => event.id)).toEqual([1]);
    expect(filterSimilarEventsByCategory(events, "outdoors").map((event) => event.id)).toEqual([2]);
    expect(filterSimilarEventsByCategory(events, "sports").map((event) => event.id)).toEqual([2, 3]);
    expect(filterSimilarEventsByCategory(events, "arts").map((event) => event.id)).toEqual([1, 4]);
  });
});
