import { describe, expect, it } from "vitest";
import { getLatestInterviewLearnings } from "./profileLearning";

describe("getLatestInterviewLearnings", () => {
  it("returns only newly added array traits from the latest interview", () => {
    const learnings = getLatestInterviewLearnings(
      { hobbies: ["Songwriting", "Cabinetry"], personalityKeywords: ["direct", "funny"] },
      { hobbies: ["Songwriting"], personalityKeywords: ["direct"] },
    );

    expect(learnings).toEqual([
      { key: "hobbies", label: "Hobbies", values: ["Cabinetry"], status: "learned" },
      { key: "personalityKeywords", label: "Personality", values: ["funny"], status: "learned" },
    ]);
  });

  it("shows changed scalar traits as updates and hides internal summary data", () => {
    const learnings = getLatestInterviewLearnings(
      { humorStyle: "dry and self-aware", aiSummary: "Do not display" },
      { humorStyle: "playful" },
    );

    expect(learnings).toEqual([
      { key: "humorStyle", label: "Humor style", values: ["dry and self-aware"], status: "updated" },
    ]);
  });

  it("does not repeat traits already known before the latest interview", () => {
    const learnings = getLatestInterviewLearnings(
      { values: ["honesty"], favoriteFood: "Italian" },
      { values: ["Honesty"], favoriteFood: "Italian" },
    );

    expect(learnings).toEqual([]);
  });
});
