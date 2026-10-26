import { describe, expect, it } from "vitest";
import { answeredJeopardyClueIds, canSubmitJeopardyAnswer } from "../shared/jeopardyAnswerPolicy";

describe("Jeopardy answer confirmation", () => {
  it("only enables confirmation for a selected clue with a non-blank answer", () => {
    expect(canSubmitJeopardyAnswer("", true, false)).toBe(false);
    expect(canSubmitJeopardyAnswer("   ", true, false)).toBe(false);
    expect(canSubmitJeopardyAnswer("Lake Michigan", false, false)).toBe(false);
    expect(canSubmitJeopardyAnswer("Lake Michigan", true, true)).toBe(false);
    expect(canSubmitJeopardyAnswer("Lake Michigan", true, false)).toBe(true);
  });

  it("derives completed clues from persisted room answers", () => {
    expect(answeredJeopardyClueIds([{ questionId: 3 }, { questionId: 8 }, { questionId: 3 }])).toEqual(new Set([3, 8]));
  });
});
