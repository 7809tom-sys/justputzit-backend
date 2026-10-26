export const ATTENDANCE_CHECK_IN_EARLY_WINDOW_MS = 12 * 60 * 60 * 1000;

export function getBookingCheckInError(
  status: string,
  scheduledFor: Date | string | null | undefined,
  now = new Date(),
) {
  if (status !== "confirmed") return "Only confirmed bookings can be checked in.";
  if (!scheduledFor) return "This booking needs a scheduled time before check-in is available.";

  const scheduledAt = new Date(scheduledFor);
  if (Number.isNaN(scheduledAt.getTime())) return "This booking needs a scheduled time before check-in is available.";
  if (scheduledAt.getTime() - now.getTime() > ATTENDANCE_CHECK_IN_EARLY_WINDOW_MS) {
    return "Check-in opens 12 hours before the activity.";
  }
  return null;
}
