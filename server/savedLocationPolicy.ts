export type SavedLocationDraft = {
  label: string;
  city: string;
  state: string;
  postalCode?: string;
  latitude: string;
  longitude: string;
  isHome?: boolean;
};

export function normalizeSavedLocationDraft(input: SavedLocationDraft, isFirstLocation: boolean) {
  return {
    ...input,
    label: input.label.trim() || input.city.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    postalCode: input.postalCode?.trim() || null,
    isHome: input.isHome === true || isFirstLocation,
  };
}

export function sortSavedLocationLabels<T extends { label: string; isHome: boolean }>(locations: T[]) {
  return [...locations].sort((a, b) => Number(b.isHome) - Number(a.isHome) || a.label.localeCompare(b.label));
}
