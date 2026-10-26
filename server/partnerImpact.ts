export type ImpactBooking = {
  status: string;
  partySize: number;
  totalPriceCents: number;
  commissionCents: number;
};

export type ImpactRsvp = {
  status: string;
  checkedIn: boolean;
  checkedInAt?: Date | string | null;
};

export type DatedImpactBooking = ImpactBooking & {
  createdAt: Date | string;
  checkedInAt?: Date | string | null;
};

export type PartnerImpactTrendPoint = {
  date: string;
  label: string;
  bookings: number;
  attendance: number;
};

export const PARTNER_TREND_MAX_RANGE_DAYS = 366;

export function parsePartnerTrendDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function getPartnerTrendRangeError(start: Date, end: Date, now = new Date()) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Choose valid start and end dates.";
  if (start.getTime() > end.getTime()) return "The start date must come before the end date.";
  const latestAllowed = new Date(now);
  latestAllowed.setHours(23, 59, 59, 999);
  if (end.getTime() > latestAllowed.getTime()) return "Choose an end date that is today or earlier.";
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount > PARTNER_TREND_MAX_RANGE_DAYS) return `Choose a range of ${PARTNER_TREND_MAX_RANGE_DAYS} days or less.`;
  return null;
}

function toDayKey(value: Date | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildPartnerImpactTrend(
  bookings: DatedImpactBooking[],
  rsvps: ImpactRsvp[],
  now = new Date(),
  days = 30,
): PartnerImpactTrendPoint[] {
  const dayKeys = Array.from({ length: days }, (_, offset) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - offset));
    return date;
  });
  const points = new Map(dayKeys.map((date) => {
    const key = toDayKey(date)!;
    return [key, { date: key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), bookings: 0, attendance: 0 }];
  }));

  bookings.forEach((booking) => {
    if (booking.status !== "cancelled") {
      const bookingPoint = points.get(toDayKey(booking.createdAt) ?? "");
      if (bookingPoint) bookingPoint.bookings += 1;
    }
    if (booking.status === "checked_in" && booking.checkedInAt) {
      const attendancePoint = points.get(toDayKey(booking.checkedInAt) ?? "");
      if (attendancePoint) attendancePoint.attendance += 1;
    }
  });
  rsvps.forEach((rsvp) => {
    if (!rsvp.checkedIn || !rsvp.checkedInAt) return;
    const attendancePoint = points.get(toDayKey(rsvp.checkedInAt) ?? "");
    if (attendancePoint) attendancePoint.attendance += 1;
  });
  return Array.from(points.values());
}

export function buildPartnerImpactTrendForRange(
  bookings: DatedImpactBooking[],
  rsvps: ImpactRsvp[],
  start: Date,
  end: Date,
) {
  const inclusiveEnd = new Date(end);
  inclusiveEnd.setHours(23, 59, 59, 999);
  const days = Math.floor((inclusiveEnd.getTime() - start.getTime()) / 86_400_000) + 1;
  return buildPartnerImpactTrend(bookings, rsvps, inclusiveEnd, days);
}

export function summarizePartnerImpact(bookings: ImpactBooking[], rsvps: ImpactRsvp[]) {
  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const attendanceSignals = activeBookings.filter((booking) => booking.status === "checked_in").length;
  const rsvpIntent = rsvps.filter((rsvp) => rsvp.status === "going" || rsvp.status === "maybe").length;
  const rsvpCheckIns = rsvps.filter((rsvp) => rsvp.checkedIn).length;

  return {
    bookingCount: activeBookings.length,
    bookedSeats: activeBookings.reduce((total, booking) => total + booking.partySize, 0),
    attendanceSignals,
    rsvpIntent,
    rsvpCheckIns,
    grossBookingValueCents: activeBookings.reduce((total, booking) => total + booking.totalPriceCents, 0),
    platformCommissionCents: activeBookings.reduce((total, booking) => total + booking.commissionCents, 0),
  };
}
