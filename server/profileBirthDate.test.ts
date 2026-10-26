import { describe, expect, it } from "vitest";
import { formatProfileBirthday, getProfileAge, isProfileBirthdayToday, parseProfileBirthDate } from "../shared/profileBirthDate";

describe("profile birth-date safeguards", () => {
  it("accepts real calendar dates and formats them safely", () => {
    expect(parseProfileBirthDate("1967-08-14")).not.toBeNull();
    expect(formatProfileBirthday("1967-08-14")).toBe("August 14");
    expect(getProfileAge("1967-08-14", new Date("2026-08-14T12:00:00Z"))).toBe(59);
  });

  it("rejects invalid, impossible, and future date values", () => {
    for (const value of ["Invalid Date", "2020-02-30", "not-a-date", "2099-01-01", undefined]) {
      expect(parseProfileBirthDate(value)).toBeNull();
      expect(formatProfileBirthday(value)).toBeNull();
      expect(getProfileAge(value)).toBeNull();
    }
  });

  it("recognizes the member's local birthday while rejecting invalid dates", () => {
    expect(isProfileBirthdayToday("1970-08-14", new Date(2026, 7, 14, 9))).toBe(true);
    expect(isProfileBirthdayToday("1970-08-15", new Date(2026, 7, 14, 9))).toBe(false);
    expect(isProfileBirthdayToday("not-a-date", new Date(2026, 7, 14, 9))).toBe(false);
  });
});
