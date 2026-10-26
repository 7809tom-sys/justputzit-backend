import type { ProfileTraits } from "../drizzle/schema";

const ALLOWED_WYR_FIELDS = ["favoriteActivities", "interests", "values"] as const;
type AllowedWyrField = (typeof ALLOWED_WYR_FIELDS)[number];

function normalize(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

function isDirectChoicePhrase(candidate: string, chosenOption: string) {
  const choiceWords = new Set(normalize(chosenOption).split(" ").filter(Boolean));
  const candidateWords = normalize(candidate).split(" ").filter((word) => word.length >= 3);
  return candidateWords.length > 0 && candidateWords.every((word) => choiceWords.has(word));
}

/**
 * A single Would You Rather answer can show a direct preference, but it is not
 * enough evidence for personality labels. Keep only short phrases that appear
 * in the exact selected option and only in preference-oriented profile fields.
 */
export function sanitizeWyrProfileInsights(
  candidate: unknown,
  chosenOption: string,
): Partial<Pick<ProfileTraits, AllowedWyrField>> {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return {};

  const record = candidate as Record<string, unknown>;
  const sanitized: Partial<Pick<ProfileTraits, AllowedWyrField>> = {};

  for (const field of ALLOWED_WYR_FIELDS) {
    const values = record[field];
    if (!Array.isArray(values)) continue;
    const valid = Array.from(new Set(values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length >= 3 && value.length <= 80)
      .filter((value) => isDirectChoicePhrase(value, chosenOption))
    ));
    if (valid.length > 0) sanitized[field] = valid;
  }

  return sanitized;
}

export function getWyrDirectPreferenceInsights(
  traits: Partial<Pick<ProfileTraits, AllowedWyrField>>,
): string[] {
  const values = ALLOWED_WYR_FIELDS.flatMap((field) => {
    const value = traits[field];
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string")
      : [];
  });
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
}
