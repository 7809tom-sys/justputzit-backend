import { describe, expect, it } from "vitest";
import { INITIAL_SHARED_WYR_DRAFTS } from "../shared/initialSharedQuestionDrafts";

describe("initial shared-question draft batch", () => {
  it("contains original, two-choice prompts intended for review—not publication", () => {
    expect(INITIAL_SHARED_WYR_DRAFTS).toHaveLength(20);
    expect(new Set(INITIAL_SHARED_WYR_DRAFTS.map(([prompt]) => prompt)).size).toBe(INITIAL_SHARED_WYR_DRAFTS.length);
    expect(INITIAL_SHARED_WYR_DRAFTS.every(([prompt]) => prompt.startsWith("Would you rather"))).toBe(true);
  });
});
