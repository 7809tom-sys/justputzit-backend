import { describe, expect, it } from "vitest";
import { getProfileCompleteness } from "../shared/profileCompleteness";

describe("profile completeness", () => {
  it("counts only the non-sensitive essentials needed for local introductions", () => {
    const result = getProfileCompleteness({ bio: "I enjoy neighborhood concerts, quiet hikes, and coffee with good conversation.", city: "Madison", interviewCount: 1 });
    expect(result).toMatchObject({ completed: 3, total: 3, score: 100 });
  });

  it("does not treat sensitive identity, dating settings, or photos as requirements", () => {
    const result = getProfileCompleteness({ aiSummary: "A curious local member who enjoys public arts events and trying new coffee shops with friendly people.", city: "", interviewCount: 0 });
    expect(result.score).toBe(33);
    expect(result.items.filter((item) => !item.complete).map((item) => item.id)).toEqual(["location", "sally"]);
  });
});
