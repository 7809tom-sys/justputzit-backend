import { describe, expect, it } from "vitest";
import { filterHomepageDiscovery } from "../shared/homepageDiscovery";

describe("homepage discovery filters", () => {
  const now = new Date("2026-08-11T12:00:00Z");
  const items = [
    { title: "Summerfest Musical", category: "arts", eventDate: "2026-08-14T18:00:00Z" },
    { title: "Basketball at the YMCA", category: "sports", eventDate: "2026-09-01T18:00:00Z" },
    { title: "Community Theater Play", category: "community", eventDate: "2026-08-20T18:00:00Z" },
  ];

  it("filters plays within a selected date range", () => {
    expect(filterHomepageDiscovery(items, { category: "plays", dateRange: "week", now })).toEqual([items[0]]);
  });

  it("sorts matching items by category when requested", () => {
    const result = filterHomepageDiscovery(items, { sortBy: "category", now });
    expect(result.map((item) => item.category)).toEqual(["arts", "community", "sports"]);
  });
});
