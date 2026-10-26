export const PICKUP_ACTIVITY_TYPES = ["basketball", "bowling_singles", "other"] as const;
export type PickupActivityType = (typeof PICKUP_ACTIVITY_TYPES)[number];

export const PICKUP_ALERT_CATEGORY = {
  basketball: "basketball",
  bowling_singles: "bowling",
  other: "community",
} as const satisfies Record<PickupActivityType, string>;

export function getPickupSafetyError(input: {
  startAt: Date;
  endAt?: Date | null;
  capacity: number;
  venueName: string;
  city: string;
}): string | null {
  if (!input.venueName.trim() || !input.city.trim()) return "Use a named public venue and city so people can decide safely.";
  if (input.capacity < 2 || input.capacity > 20) return "Pickup activities must be for 2 to 20 people.";
  if (input.startAt.getTime() < Date.now() + 10 * 60 * 1000) return "Choose a start time at least 10 minutes from now.";
  if (input.startAt.getTime() > Date.now() + 14 * 24 * 60 * 60 * 1000) return "Keep pickup activities within the next 14 days.";
  if (input.endAt && input.endAt.getTime() <= input.startAt.getTime()) return "The end time must be after the start time.";
  return null;
}

export function isPickupPreferenceMatch(activityType: PickupActivityType, categories: string[]) {
  const category = PICKUP_ALERT_CATEGORY[activityType];
  return categories.includes(category) || categories.includes("sports") || categories.includes("community");
}

export function selectSimilarActivities<T extends { category: string }>(activities: T[], categories: string[], limit = 4) {
  const normalized = new Set(categories);
  const matching = activities.filter((activity) => normalized.has(activity.category) || (activity.category === "basketball" && normalized.has("sports")) || (activity.category === "bowling" && normalized.has("community")));
  return (matching.length > 0 ? matching : activities).slice(0, limit);
}

export function pickupTemplate(type: PickupActivityType) {
  if (type === "basketball") {
    return {
      title: "Pickup basketball — 3:00–5:00 PM",
      description: "Open pickup basketball at a public gym. Confirm court access or guest rules before you go.",
      category: "basketball",
    };
  }
  if (type === "bowling_singles") {
    return {
      title: "Bowling Singles Mixer",
      description: "A low-pressure public bowling mixer for singles. Confirm lane availability with the alley before you go.",
      category: "bowling",
    };
  }
  return { title: "Public pickup activity", description: "A public-venue activity for nearby members.", category: "community" };
}
