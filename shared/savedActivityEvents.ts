export type SavedActivityEventCandidate = {
  eventDate: Date | null;
  isRecurring: boolean;
  isActive: boolean;
  savedAt: Date;
};

/** Keep saved plans useful: recurring and evergreen activities remain available,
 * while one-off activities disappear after their scheduled time has passed. */
export function selectCurrentSavedActivityEvents<T extends SavedActivityEventCandidate>(
  events: T[],
  now = new Date(),
): T[] {
  return events
    .filter((event) => event.isActive)
    .filter((event) => event.isRecurring || event.eventDate === null || event.eventDate.getTime() >= now.getTime())
    .sort((a, b) => {
      const aTime = a.isRecurring ? Number.MAX_SAFE_INTEGER : a.eventDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.isRecurring ? Number.MAX_SAFE_INTEGER : b.eventDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime || b.savedAt.getTime() - a.savedAt.getTime();
    });
}
