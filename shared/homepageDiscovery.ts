export type HomepageDiscoveryDateRange = "all" | "week" | "month";
export type HomepageDiscoverySort = "date" | "category";

export type HomepageDiscoveryItem = {
  eventDate?: Date | string | number | null;
  category?: string | null;
  title?: string | null;
};

function timestamp(value: HomepageDiscoveryItem["eventDate"]): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return Number.POSITIVE_INFINITY;
}

function matchesCategory(item: HomepageDiscoveryItem, category: string): boolean {
  if (category === "all") return true;
  const itemCategory = (item.category ?? "").toLowerCase();
  const title = (item.title ?? "").toLowerCase();
  if (category === "plays") {
    return itemCategory === "arts" || /play|theater|theatre|musical|performance/.test(title);
  }
  return itemCategory === category.toLowerCase();
}

export function filterHomepageDiscovery<T extends HomepageDiscoveryItem>(
  items: T[],
  options: {
    dateRange?: HomepageDiscoveryDateRange;
    category?: string;
    sortBy?: HomepageDiscoverySort;
    now?: Date;
  } = {},
): T[] {
  const dateRange = options.dateRange ?? "all";
  const category = options.category ?? "all";
  const sortBy = options.sortBy ?? "date";
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const cutoff = dateRange === "week"
    ? nowMs + 7 * 24 * 60 * 60 * 1000
    : dateRange === "month"
      ? nowMs + 31 * 24 * 60 * 60 * 1000
      : Number.POSITIVE_INFINITY;

  return items
    .filter((item) => matchesCategory(item, category))
    .filter((item) => {
      const itemTime = timestamp(item.eventDate);
      return itemTime === Number.POSITIVE_INFINITY || (itemTime >= nowMs && itemTime <= cutoff);
    })
    .sort((a, b) => {
      if (sortBy === "category") {
        const categoryOrder = (a.category ?? "other").localeCompare(b.category ?? "other");
        if (categoryOrder !== 0) return categoryOrder;
      }
      return timestamp(a.eventDate) - timestamp(b.eventDate);
    });
}
