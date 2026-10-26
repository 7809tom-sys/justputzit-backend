export function getRescheduleRequestError(status: string, requestedFor: Date) {
  if (status !== "confirmed") return "Only confirmed bookings can be rescheduled.";
  if (Number.isNaN(requestedFor.getTime()) || requestedFor.getTime() <= Date.now()) {
    return "Choose a future date and time for your request.";
  }
  return null;
}
