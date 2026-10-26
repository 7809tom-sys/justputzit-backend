import { describe, expect, it } from "vitest";
import { ATTENDANCE_CHECK_IN_EARLY_WINDOW_MS, getBookingCheckInError } from "../shared/attendanceProof";
import { buildPartnerImpactTrend, buildPartnerImpactTrendForRange, getPartnerTrendRangeError, parsePartnerTrendDate, summarizePartnerImpact } from "./partnerImpact";

describe("attendance proof", () => {
  const now = new Date("2026-08-12T12:00:00.000Z");

  it("allows a confirmed booking to be privately checked in close to its scheduled time", () => {
    expect(getBookingCheckInError("confirmed", new Date(now.getTime() + ATTENDANCE_CHECK_IN_EARLY_WINDOW_MS), now)).toBeNull();
  });

  it("rejects early, cancelled, and unscheduled booking check-ins", () => {
    expect(getBookingCheckInError("confirmed", new Date(now.getTime() + ATTENDANCE_CHECK_IN_EARLY_WINDOW_MS + 1), now)).toBe("Check-in opens 12 hours before the activity.");
    expect(getBookingCheckInError("cancelled", now, now)).toBe("Only confirmed bookings can be checked in.");
    expect(getBookingCheckInError("confirmed", null, now)).toBe("This booking needs a scheduled time before check-in is available.");
  });

  it("summarizes only active bookings and aggregate RSVP signals", () => {
    expect(summarizePartnerImpact([
      { status: "confirmed", partySize: 2, totalPriceCents: 4000, commissionCents: 480 },
      { status: "checked_in", partySize: 3, totalPriceCents: 6000, commissionCents: 720 },
      { status: "cancelled", partySize: 4, totalPriceCents: 8000, commissionCents: 960 },
    ], [
      { status: "going", checkedIn: true },
      { status: "maybe", checkedIn: false },
      { status: "not_going", checkedIn: false },
    ])).toMatchObject({ bookingCount: 2, bookedSeats: 5, attendanceSignals: 1, rsvpIntent: 2, rsvpCheckIns: 1, grossBookingValueCents: 10000, platformCommissionCents: 1200 });
  });

  it("builds a complete 30-day aggregate trend without exposing member details", () => {
    const trend = buildPartnerImpactTrend([
      { status: "confirmed", partySize: 2, totalPriceCents: 4000, commissionCents: 480, createdAt: "2026-08-11T10:00:00.000Z" },
      { status: "checked_in", partySize: 2, totalPriceCents: 4000, commissionCents: 480, createdAt: "2026-08-12T10:00:00.000Z", checkedInAt: "2026-08-12T12:00:00.000Z" },
      { status: "cancelled", partySize: 2, totalPriceCents: 4000, commissionCents: 480, createdAt: "2026-08-12T10:00:00.000Z" },
    ], [{ status: "going", checkedIn: true, checkedInAt: "2026-08-12T13:00:00.000Z" }], new Date("2026-08-12T15:00:00.000Z"));

    expect(trend).toHaveLength(30);
    expect(trend.at(-1)).toMatchObject({ bookings: 1, attendance: 2 });
    expect(trend.at(-2)).toMatchObject({ bookings: 1, attendance: 0 });
  });

  it("validates custom ranges and returns an inclusive daily series", () => {
    const start = parsePartnerTrendDate("2026-08-10");
    const end = parsePartnerTrendDate("2026-08-12");
    expect(getPartnerTrendRangeError(start, end, new Date("2026-08-12T14:00:00.000Z"))).toBeNull();
    expect(getPartnerTrendRangeError(end, start, new Date("2026-08-12T14:00:00.000Z"))).toBe("The start date must come before the end date.");
    expect(buildPartnerImpactTrendForRange([{ status: "confirmed", partySize: 1, totalPriceCents: 0, commissionCents: 0, createdAt: "2026-08-11T10:00:00.000Z" }], [], start, end)).toMatchObject([
      { date: "2026-08-10", bookings: 0 },
      { date: "2026-08-11", bookings: 1 },
      { date: "2026-08-12", bookings: 0 },
    ]);
  });
});
