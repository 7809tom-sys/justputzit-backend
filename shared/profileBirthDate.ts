const BIRTH_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseProfileBirthDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = value.match(BIRTH_DATE_PATTERN);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    !Number.isFinite(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() > Date.now()
  ) {
    return null;
  }
  return date;
}

export function getProfileAge(value: unknown, now = new Date()): number | null {
  const birthDate = parseProfileBirthDate(value);
  if (!birthDate) return null;
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const birthdayThisYear = Date.UTC(now.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
  if (now.getTime() < birthdayThisYear) age -= 1;
  return age >= 0 && age <= 125 ? age : null;
}

/**
 * Birthday celebrations are rendered only in the signed-in member's own
 * profile. Compare month/day in the member's current browser locale so the
 * greeting arrives on their local calendar day.
 */
export function isProfileBirthdayToday(value: unknown, now = new Date()): boolean {
  const birthDate = parseProfileBirthDate(value);
  if (!birthDate) return false;
  return birthDate.getUTCMonth() === now.getMonth() && birthDate.getUTCDate() === now.getDate();
}

export function formatProfileBirthday(value: unknown): string | null {
  const birthDate = parseProfileBirthDate(value);
  return birthDate
    ? birthDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })
    : null;
}
