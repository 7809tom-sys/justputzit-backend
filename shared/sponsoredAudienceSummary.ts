export const SPONSORED_AUDIENCE_MIN_GROUP_SIZE = 5;

export type SponsoredAudienceSummary = {
  isSuppressed: boolean;
  minimumGroupSize: number;
  signUpCount: number;
  ageBands: Array<{ label: string; count: number }>;
  topInterests: Array<{ label: string; count: number }>;
};

function getAgeBand(birthDate: Date, now: Date) {
  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const hasHadBirthday = now.getUTCMonth() > birthDate.getUTCMonth()
    || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());
  if (!hasHadBirthday) age -= 1;
  if (age < 18 || age > 110) return null;
  if (age <= 24) return "18–24";
  if (age <= 34) return "25–34";
  if (age <= 44) return "35–44";
  if (age <= 54) return "45–54";
  if (age <= 64) return "55–64";
  return "65+";
}

function countAndSuppress(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries())
    .filter(([, count]) => count >= SPONSORED_AUDIENCE_MIN_GROUP_SIZE)
    .sort(([leftLabel, leftCount], [rightLabel, rightCount]) => rightCount - leftCount || leftLabel.localeCompare(rightLabel))
    .map(([label, count]) => ({ label, count }));
}

export function buildSponsoredAudienceSummary(input: {
  signUpCount: number;
  birthDates: Array<Date | null>;
  interestCategories: string[];
  now?: Date;
}): SponsoredAudienceSummary {
  if (input.signUpCount < SPONSORED_AUDIENCE_MIN_GROUP_SIZE) {
    return {
      isSuppressed: true,
      minimumGroupSize: SPONSORED_AUDIENCE_MIN_GROUP_SIZE,
      signUpCount: input.signUpCount,
      ageBands: [],
      topInterests: [],
    };
  }

  const now = input.now ?? new Date();
  const ageBands = countAndSuppress(input.birthDates.flatMap((birthDate) => birthDate ? [getAgeBand(birthDate, now)].filter(Boolean) as string[] : []));
  const topInterests = countAndSuppress(input.interestCategories.map((category) => category.replace(/_/g, " "))).slice(0, 3);
  return {
    isSuppressed: false,
    minimumGroupSize: SPONSORED_AUDIENCE_MIN_GROUP_SIZE,
    signUpCount: input.signUpCount,
    ageBands,
    topInterests,
  };
}
