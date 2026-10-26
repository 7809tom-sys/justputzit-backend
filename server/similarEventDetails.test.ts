import { describe, expect, it } from "vitest";
import { formatSimilarEventDistance, selectSimilarEventDetails } from "../shared/similarEventDetails";

describe("similar event details", () => {
  it("prioritizes events matching both the viewed category and explicit preferences", () => {
    const events = [
      { id: 1, category: "library" },
      { id: 2, category: "library" },
      { id: 3, category: "basketball" },
      { id: 4, category: "arts" },
    ];
    expect(selectSimilarEventDetails({ activities: events, currentActivityId: 1, currentCategory: "library", preferredCategories: ["library", "basketball"] }).map((event) => event.id)).toEqual([2, 3, 4]);
  });

  it("formats a clear distance indicator and has a no-location fallback", () => {
    expect(formatSimilarEventDistance(4.6)).toBe("Distance from you: 4.6 mi away");
    expect(formatSimilarEventDistance(null)).toBe("Distance from you unavailable");
  });
});
