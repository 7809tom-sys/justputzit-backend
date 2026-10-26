import { describe, expect, it } from "vitest";
import { formatAdminDate } from "../shared/adminDates";

describe("administrator member dates", () => {
  it("formats promotion and last-active dates consistently", () => {
    expect(formatAdminDate("2026-08-11T12:00:00.000Z")).toMatch(/2026/);
    expect(formatAdminDate(new Date("2025-01-05T12:00:00.000Z"))).toMatch(/2025/);
  });

  it("uses a clear fallback when a date is unavailable or invalid", () => {
    expect(formatAdminDate(null)).toBe("—");
    expect(formatAdminDate("not-a-date")).toBe("—");
  });
});
