export type ConnectionPreferences = {
  community: true;
  friendship: boolean;
  dating: boolean;
  gymBuddy: boolean;
};

export const DEFAULT_CONNECTION_PREFERENCES: ConnectionPreferences = {
  community: true,
  friendship: false,
  dating: false,
  gymBuddy: false,
};

export function normalizeConnectionPreferences(value: unknown): ConnectionPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_CONNECTION_PREFERENCES };
  const candidate = value as Partial<ConnectionPreferences>;
  return {
    community: true,
    friendship: candidate.friendship === true,
    dating: candidate.dating === true,
    gymBuddy: candidate.gymBuddy === true,
  };
}

export function hasSharedConnectionIntent(one: unknown, two: unknown) {
  const first = normalizeConnectionPreferences(one);
  const second = normalizeConnectionPreferences(two);
  return (first.friendship && second.friendship) || (first.dating && second.dating) || (first.gymBuddy && second.gymBuddy);
}
