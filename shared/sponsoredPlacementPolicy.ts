export const SPONSORED_PLACEMENT_PACKAGES = {
  week: {
    label: "7-day featured placement",
    description: "A clearly labeled Sponsored card near the top of relevant local activity recommendations for seven days.",
    amountCents: 9900,
    durationDays: 7,
  },
  month: {
    label: "30-day featured placement",
    description: "A clearly labeled Sponsored card near the top of relevant local activity recommendations for thirty days.",
    amountCents: 24900,
    durationDays: 30,
  },
} as const;

export type SponsoredPlacementPackage = keyof typeof SPONSORED_PLACEMENT_PACKAGES;

export function getSponsoredPlacementPackage(packageCode: SponsoredPlacementPackage) {
  return SPONSORED_PLACEMENT_PACKAGES[packageCode];
}

export function getSponsoredPlacementEligibility(input: {
  listingIsActive: boolean;
  listingIsPublicAccess: boolean;
  venueIsPublicAccess: boolean;
}) {
  if (!input.listingIsActive) return "Only active activities can be promoted.";
  return null;
}

export function isActiveSponsoredPlacement(input: { status: string; endsAt?: Date | null }, now = new Date()) {
  return input.status === "active" && !!input.endsAt && input.endsAt > now;
}
