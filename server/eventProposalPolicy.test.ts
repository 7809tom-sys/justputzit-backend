import { describe, expect, it } from "vitest";
import { getEventProposalStatusCopy, isEligiblePublicEventProposal } from "../shared/eventProposalPolicy";
import { hasSharedConnectionIntent, normalizeConnectionPreferences } from "../shared/connectionPreferences";

describe("public event proposal policy", () => {
  const now = new Date("2026-08-14T12:00:00.000Z");

  it("only allows active, upcoming public events", () => {
    expect(isEligiblePublicEventProposal({ isActive: true, eventDate: "2026-08-14T12:00:00.000Z" }, now)).toBe(true);
    expect(isEligiblePublicEventProposal({ isActive: true, eventDate: "2026-08-14T11:59:59.000Z" }, now)).toBe(false);
    expect(isEligiblePublicEventProposal({ isActive: false, eventDate: "2026-08-15T12:00:00.000Z" }, now)).toBe(false);
  });

  it("keeps responses private and clear for each proposal status", () => {
    expect(getEventProposalStatusCopy("pending", true)).toContain("accept or decline privately");
    expect(getEventProposalStatusCopy("pending", false)).toContain("Waiting");
    expect(getEventProposalStatusCopy("accepted", false)).toBe("You’re going together!");
    expect(getEventProposalStatusCopy("declined", true)).toContain("No further action");
  });

  it("allows gym-buddy intent to be a deliberate shared connection path", () => {
    expect(normalizeConnectionPreferences({ gymBuddy: true })).toMatchObject({ community: true, gymBuddy: true });
    expect(hasSharedConnectionIntent({ gymBuddy: true }, { gymBuddy: true })).toBe(true);
    expect(hasSharedConnectionIntent({ gymBuddy: true }, { friendship: true })).toBe(false);
  });
});
