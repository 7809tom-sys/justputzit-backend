import { isCurrentOrUpcomingEvent } from "../shared/currentEventFilter";

export type EventRecommendationCandidate = {
  id: number;
  eventDate: Date;
  endDate?: Date | null;
  externalUrl: string | null;
};

/**
 * Sally only offers events that are still upcoming, point to a live source, and
 * have not been rejected by the user. This prevents stale or generated-only
 * events from entering an interview recommendation.
 */
export function selectCurrentVerifiedEvents<T extends EventRecommendationCandidate>(
  events: T[],
  responses: ReadonlyMap<number, string>,
  limit: number,
  now = new Date(),
): T[] {
  return events
    .filter((event) => (
      isCurrentOrUpcomingEvent(event.eventDate, event.endDate, now)
      && Boolean(event.externalUrl)
      && responses.get(event.id) !== "not_for_me"
    ))
    .slice(0, limit);
}
