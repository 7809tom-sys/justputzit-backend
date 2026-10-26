export function isCurrentOrUpcomingEvent(eventDate: Date, endDate?: Date | null, now = new Date()) {
  return (endDate ?? eventDate).getTime() >= now.getTime();
}
