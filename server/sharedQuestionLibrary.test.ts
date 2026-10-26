import { describe, expect, it } from "vitest";
import { isSharedQuestionFormatEligible, toSharedQuestionClientRecord } from "../shared/sharedQuestionLibrary";

describe("governed shared question library", () => {
  it("permits only question formats that fit each target game", () => {
    expect(isSharedQuestionFormatEligible("would_you_rather", "would_you_rather")).toBe(true);
    expect(isSharedQuestionFormatEligible("multiple_choice", "trivia")).toBe(true);
    expect(isSharedQuestionFormatEligible("visual", "jeopardy")).toBe(true);
    expect(isSharedQuestionFormatEligible("multiple_choice", "jeopardy")).toBe(false);
    expect(isSharedQuestionFormatEligible("would_you_rather", "trivia")).toBe(false);
  });

  it("builds client records without a canonical or accepted answer field", () => {
    const record = toSharedQuestionClientRecord({
      id: 7,
      prompt: "Which city is known as the Cream City?",
      format: "multiple_choice",
      category: "local",
      difficulty: "easy",
      optionA: "Milwaukee",
      optionB: "Madison",
      optionC: "Chicago",
      optionD: "Green Bay",
      imageUrl: null,
      attribution: null,
      sourceUrl: "https://example.com/source",
      gameConfig: { timerSeconds: 15 },
    });

    expect(record).toMatchObject({ id: 7, optionA: "Milwaukee", gameConfig: { timerSeconds: 15 } });
    expect(record).not.toHaveProperty("canonicalAnswer");
    expect(record).not.toHaveProperty("acceptedAnswers");
  });
});
