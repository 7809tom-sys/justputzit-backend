import { describe, expect, it } from "vitest";
import { BLOCKED_CONVERSATION_MESSAGE, isValidMemberSafetyTarget } from "../shared/memberSafetyPolicy";

describe("member safety policy", () => {
  it("allows reporting or blocking another valid member, but never oneself", () => {
    expect(isValidMemberSafetyTarget(7, 8)).toBe(true);
    expect(isValidMemberSafetyTarget(7, 7)).toBe(false);
    expect(isValidMemberSafetyTarget(0, 7)).toBe(false);
  });

  it("keeps the post-block conversation state clear and neutral", () => {
    expect(BLOCKED_CONVERSATION_MESSAGE).toBe("This conversation is closed");
  });
});
