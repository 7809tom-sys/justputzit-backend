import { describe, expect, it } from "vitest";
import { deriveGameAchievements } from "./memberDashboard";

describe("member dashboard achievements", () => {
  it("unlocks only fully completed social-game paths and preserves progress for the rest", () => {
    const achievements = deriveGameAchievements({
      local_afternoon_style: "A coffee and a neighborhood stroll",
      local_recommendation_style: "A hidden breakfast spot",
      community_connection_style: "A class or club",
      public_plan_interest: "Meet at a farmers market",
    }, 3, 0);
    expect(achievements.find((item) => item.id === "local_legend")).toMatchObject({ unlocked: true, progressLabel: "Unlocked" });
    expect(achievements.find((item) => item.id === "would_you_join_me")).toMatchObject({ unlocked: true });
    expect(achievements.find((item) => item.id === "perfect_saturday")).toMatchObject({ unlocked: false, progressLabel: "0 of 4 picks" });
    expect(achievements.find((item) => item.id === "would_you_rather")).toMatchObject({ unlocked: false, progressLabel: "3 of 5 answers" });
  });

  it("unlocks shared challenge and Would You Rather milestones from durable counts", () => {
    const achievements = deriveGameAchievements({}, 7, 1);
    expect(achievements.find((item) => item.id === "would_you_rather")?.unlocked).toBe(true);
    expect(achievements.find((item) => item.id === "wyr_challenge")?.unlocked).toBe(true);
  });
});
