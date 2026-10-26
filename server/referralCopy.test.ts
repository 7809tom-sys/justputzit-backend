import { describe, expect, it } from "vitest";
import { buildJustPutzitReferralMessage, JUST_PUTZIT_REFERRAL_NOTE } from "../shared/referralCopy";

describe("community-first referral copy", () => {
  it("invites friends through events, activities, and real-world connection without city or dating-first claims", () => {
    const message = buildJustPutzitReferralMessage("https://justputzit.com/?invite=abc123");
    expect(message).toContain("local events, activities, and real-world connection");
    expect(message).toContain("https://justputzit.com/?invite=abc123");
    expect(message.toLocaleLowerCase()).not.toContain("dating app");
    expect(message).not.toContain("Waukesha");
  });

  it("keeps a member’s edited note and always appends the unique invite link", () => {
    expect(buildJustPutzitReferralMessage("https://justputzit.com/?invite=custom", "Want to check out a library event together?"))
      .toBe("Want to check out a library event together?\n\nhttps://justputzit.com/?invite=custom");
    expect(buildJustPutzitReferralMessage("https://justputzit.com/?invite=default", "   "))
      .toContain(JUST_PUTZIT_REFERRAL_NOTE);
  });
});
