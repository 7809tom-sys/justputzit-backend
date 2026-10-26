export type SimilarEventSort = "personalized" | "date" | "distance";

type SortableSimilarEvent = {
  eventDate?: Date | string | null;
  distanceMiles?: number | null;
};

export function sortSimilarEvents<T extends SortableSimilarEvent>(events: T[], sort: SimilarEventSort) {
  if (sort === "personalized") return [...events];
  return events
    .map((event, index) => ({ event, index }))
    .sort((left, right) => {
      const leftValue = sort === "date"
        ? (left.event.eventDate ? new Date(left.event.eventDate).getTime() : Number.POSITIVE_INFINITY)
        : (left.event.distanceMiles ?? Number.POSITIVE_INFINITY);
      const rightValue = sort === "date"
        ? (right.event.eventDate ? new Date(right.event.eventDate).getTime() : Number.POSITIVE_INFINITY)
        : (right.event.distanceMiles ?? Number.POSITIVE_INFINITY);
      return leftValue === rightValue ? left.index - right.index : leftValue - rightValue;
    })
    .map(({ event }) => event);
}
