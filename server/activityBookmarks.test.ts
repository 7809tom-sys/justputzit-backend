import { describe, expect, it } from "vitest";
import { getActivityBookmarkFeedback, isActivityBookmarked } from "../shared/activityBookmarks";

describe("activity bookmarks", () => {
  it("identifies saved activities and uses clear feedback", () => {
    expect(isActivityBookmarked([3, 9], 9)).toBe(true);
    expect(isActivityBookmarked([3, 9], 2)).toBe(false);
    expect(getActivityBookmarkFeedback(true)).toEqual({ title: "Event saved", description: "You can find it again in your saved events." });
    expect(getActivityBookmarkFeedback(false)).toEqual({ title: "Event removed", description: "It is no longer in your saved events." });
  });
});
