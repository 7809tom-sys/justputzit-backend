import { describe, expect, it } from "vitest";
import { reorderHomepageSections, toggleHomepageSection } from "../shared/homepageLayout";

describe("homepage section selection", () => {
  const sections = [
    { moduleId: "games", position: 0, pinned: false },
    { moduleId: "community", position: 1, pinned: true },
  ];

  it("reorders sections and rewrites persisted positions", () => {
    expect(reorderHomepageSections(sections, 1, 0)).toEqual([
      { moduleId: "community", position: 0, pinned: true },
      { moduleId: "games", position: 1, pinned: false },
    ]);
  });

  it("adds or removes only the checked homepage section", () => {
    const added = toggleHomepageSection(sections, "games");
    expect(added).toEqual([
      { moduleId: "games", position: 0, pinned: true },
      { moduleId: "community", position: 1, pinned: true },
    ]);

    expect(toggleHomepageSection(added, "community")[1]?.pinned).toBe(false);
  });
});
