export type SimilarEventCategoryFilter = "all" | "family" | "outdoors" | "sports" | "arts";

type CategorizedSimilarEvent = { category?: string | null };

export const SIMILAR_EVENT_CATEGORY_FILTERS: Array<{ value: SimilarEventCategoryFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "family", label: "Family-friendly" },
  { value: "outdoors", label: "Outdoors" },
  { value: "sports", label: "Active & sports" },
  { value: "arts", label: "Arts & culture" },
];

const FILTER_CATEGORIES: Record<Exclude<SimilarEventCategoryFilter, "all">, string[]> = {
  family: ["library", "park", "mini_golf", "movies", "community_center", "sports"],
  outdoors: ["park", "hiking", "kayaking", "sports"],
  sports: ["sports", "bowling", "mini_golf", "hiking", "kayaking"],
  arts: ["arts", "movies", "cooking_class", "library"],
};

export function filterSimilarEventsByCategory<T extends CategorizedSimilarEvent>(events: T[], filter: SimilarEventCategoryFilter) {
  if (filter === "all") return [...events];
  return events.filter((event) => FILTER_CATEGORIES[filter].includes(event.category ?? "other"));
}
