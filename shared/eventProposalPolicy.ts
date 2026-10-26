export type PublicEventProposalCandidate = {
  isActive: boolean;
  eventDate: Date | string;
};

export function isEligiblePublicEventProposal(event: PublicEventProposalCandidate | null | undefined, now = new Date()) {
  if (!event || !event.isActive) return false;
  const eventTime = new Date(event.eventDate).getTime();
  return Number.isFinite(eventTime) && eventTime >= now.getTime();
}

export function getEventProposalStatusCopy(status: "pending" | "accepted" | "declined" | "withdrawn", viewerIsRecipient: boolean) {
  if (status === "accepted") return "You’re going together!";
  if (status === "declined") return "Invitation declined. No further action is needed.";
  if (status === "withdrawn") return "Invitation withdrawn.";
  return viewerIsRecipient ? "Choose accept or decline privately." : "Waiting for their answer. They can accept or decline privately.";
}
