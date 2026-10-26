export function mergeProfileTraits(
  existingTraits: Record<string, unknown> | null | undefined,
  learnedTraits: Record<string, unknown> | null | undefined,
) {
  const merged: Record<string, unknown> = { ...(existingTraits ?? {}) };

  for (const [key, value] of Object.entries(learnedTraits ?? {})) {
    if (Array.isArray(value)) {
      const prior = Array.isArray(merged[key]) ? merged[key] : [];
      const seen = new Set<string>();
      const combined = [...prior, ...value]
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .filter((entry) => {
          const comparisonKey = entry.toLocaleLowerCase();
          if (seen.has(comparisonKey)) return false;
          seen.add(comparisonKey);
          return true;
        });
      if (combined.length > 0) merged[key] = combined;
    } else if (typeof value === "string") {
      const cleanValue = value.trim();
      if (cleanValue) merged[key] = cleanValue;
    } else if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  return merged;
}
