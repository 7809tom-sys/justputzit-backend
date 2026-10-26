import { describe, expect, it } from "vitest";
import { assertSharedQuestionReadyForApproval } from "./routers";

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    prompt: "Would you rather take the scenic route or the faster route?",
    format: "would_you_rather",
    category: "travel",
    difficulty: "easy",
    optionA: "Take the scenic route",
    optionB: "Take the faster route",
    optionC: null,
    optionD: null,
    canonicalAnswer: null,
    acceptedAnswers: [],
    imageUrl: null,
    sourceUrl: null,
    license: null,
    attribution: null,
    contentStatus: "draft",
    revision: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    targets: [{ questionId: 1, gameType: "would_you_rather", enabled: true, gameConfig: {} }],
    ...overrides,
  } as any;
}

describe("shared-question editorial gate", () => {
  it("allows a complete draft with a compatible target", () => {
    expect(() => assertSharedQuestionReadyForApproval(question())).not.toThrow();
  });

  it("rejects a question whose target does not support its format", () => {
    expect(() => assertSharedQuestionReadyForApproval(question({
      targets: [{ questionId: 1, gameType: "trivia", enabled: true, gameConfig: {} }],
    }))).toThrow("do not support this question format");
  });

  it("requires full provenance and answer data before approving a visual clue", () => {
    expect(() => assertSharedQuestionReadyForApproval(question({
      format: "visual",
      canonicalAnswer: "A lighthouse",
      targets: [{ questionId: 1, gameType: "jeopardy", enabled: true, gameConfig: {} }],
    }))).toThrow("Visual questions need image provenance");
  });
});
