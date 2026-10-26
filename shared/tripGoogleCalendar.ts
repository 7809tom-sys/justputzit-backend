type TripItem = { title?: string; time?: string | null; location?: string | null; notes?: string | null };
type TripCalendarInput = { title?: string; tripDate?: string; city?: string; notes?: string | null; items?: TripItem[] };

function validDatePart(value: string | undefined | null) {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function calendarDate(date: string) {
  return date.replace(/-/g, "");
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Creates one all-day Google Calendar itinerary event; detailed item timing remains available through .ics. */
export function buildTripGoogleCalendarUrl(trip: TripCalendarInput): string | null {
  const tripDate = validDatePart(trip.tripDate);
  if (!trip.title?.trim() || !tripDate) return null;

  const dates = [tripDate, ...(trip.items ?? []).map((item) => validDatePart(item.time)).filter((date): date is string => Boolean(date))].sort();
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const itinerary = (trip.items ?? [])
    .map((item) => `• ${item.title?.trim() || "Activity"}${item.location ? ` — ${item.location}` : ""}`)
    .join("\n");
  const details = [trip.notes?.trim(), itinerary ? `Itinerary:\n${itinerary}` : ""].filter(Boolean).join("\n\n") || "Just Putzit trip itinerary";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: trip.title.trim(),
    dates: `${calendarDate(firstDate)}/${calendarDate(addDays(lastDate, 1))}`,
    details,
    location: trip.city?.trim() || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
