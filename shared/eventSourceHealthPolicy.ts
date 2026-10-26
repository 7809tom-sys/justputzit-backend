export type EventSourceHealthStatus = "healthy" | "empty" | "failed";

export function getEventSourceHealthSummary(status: EventSourceHealthStatus, eventsFound: number): string {
  if (status === "healthy") return `${eventsFound} upcoming event${eventsFound === 1 ? "" : "s"} found`;
  if (status === "empty") return "No upcoming events returned on the last check";
  return "Last refresh failed; the prior listings remain available where possible";
}
