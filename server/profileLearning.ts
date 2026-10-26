import type { ProfileTraits } from "../drizzle/schema";

export type LatestLearnedTrait = {
  key: string;
  label: string;
  values: string[];
  status: "learned" | "updated";
};

const HIDDEN_TRAIT_KEYS = new Set([
  "aiSummary",
  "gameInsights",
  "gameSignals",
  "profileCompleteness",
]);

const TRAIT_LABELS: Record<string, string> = {
  hobbies: "Hobbies",
  favoriteActivities: "Favorite activities",
  personalityKeywords: "Personality",
  dreamVacation: "Dream trip",
  favoriteFood: "Favorite food",
  morningOrNight: "Daily rhythm",
  biggestPetPeeve: "Pet peeve",
  guiltPleasure: "Guilty pleasure",
  idealWeekend: "Ideal weekend",
  funFact: "Fun fact",
  lookingFor: "Looking for",
  idealDate: "Ideal date",
  perfectSunday: "Perfect Sunday",
  humorStyle: "Humor style",
  socialStyle: "Social style",
  competitiveStyle: "Competitive style",
  values: "Values",
  interests: "Interests",
  adventurousness: "Adventure style",
};

function traitLabel(key: string) {
  return TRAIT_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function asDisplayValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string | number => typeof item === "string" || typeof item === "number")
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string" || typeof value === "number") {
    const formatted = String(value).trim();
    return formatted ? [formatted] : [];
  }

  return [];
}

/**
 * Produces a user-facing diff between the two most recent completed interviews.
 * Arrays report only items newly added in the latest interview. Scalar values
 * report when Sally learned or updated a value.
 */
export function getLatestInterviewLearnings(
  latestTraits: ProfileTraits | Record<string, unknown> | null | undefined,
  previousTraits: ProfileTraits | Record<string, unknown> | null | undefined,
): LatestLearnedTrait[] {
  const latest = latestTraits ?? {};
  const previous = previousTraits ?? {};

  return Object.entries(latest).flatMap(([key, latestValue]) => {
    if (HIDDEN_TRAIT_KEYS.has(key)) return [];

    const latestValues = asDisplayValues(latestValue);
    if (latestValues.length === 0) return [];

    const previousValue = previous[key];
    const previousValues = asDisplayValues(previousValue);

    if (Array.isArray(latestValue)) {
      const priorSet = new Set(previousValues.map((value) => value.toLocaleLowerCase()));
      const additions = latestValues.filter((value) => !priorSet.has(value.toLocaleLowerCase()));
      return additions.length
        ? [{ key, label: traitLabel(key), values: additions, status: "learned" as const }]
        : [];
    }

    const hasPreviousValue = previousValues.length > 0;
    const status = hasPreviousValue ? "updated" : "learned";
    const isUnchanged = hasPreviousValue && previousValues[0]?.toLocaleLowerCase() === latestValues[0]?.toLocaleLowerCase();
    return isUnchanged ? [] : [{ key, label: traitLabel(key), values: latestValues, status }];
  });
}
