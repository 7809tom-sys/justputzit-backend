import { describe, expect, it } from "vitest";
import { getRescheduleRequestError } from "./bookingManagement";

describe("dashboard booking management", () => {
  it("allows a future reschedule request only for confirmed bookings", () => {
    expect(getRescheduleRequestError("confirmed", new Date(Date.now() + 60_000))).toBeNull();
    expect(getRescheduleRequestError("cancelled", new Date(Date.now() + 60_000))).toBe("Only confirmed bookings can be rescheduled.");
  });

  it("rejects past or invalid requested times", () => {
    expect(getRescheduleRequestError("confirmed", new Date(Date.now() - 60_000))).toBe("Choose a future date and time for your request.");
    expect(getRescheduleRequestError("confirmed", new Date("invalid"))).toBe("Choose a future date and time for your request.");
  });
});
