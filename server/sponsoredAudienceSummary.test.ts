import { describe, expect, it } from "vitest";
import { buildSponsoredAudienceSummary } from "../shared/sponsoredAudienceSummary";

describe("sponsored audience summary", () => {
  it("suppresses demographic detail until the minimum group size is met", () => {
    expect(buildSponsoredAudienceSummary({ signUpCount: 4, birthDates: [], interestCategories: [] })).toMatchObject({
      isSuppressed: true,
      ageBands: [],
      topInterests: [],
    });
  });

  it("reports only age bands and interests that independently meet the suppression threshold", () => {
    const result = buildSponsoredAudienceSummary({
      signUpCount: 6,
      birthDates: Array.from({ length: 5 }, () => new Date("1995-06-15")),
      interestCategories: ["bowling", "bowling", "bowling", "bowling", "bowling", "basketball"],
      now: new Date("2026-08-14T00:00:00Z"),
    });
    expect(result).toMatchObject({ isSuppressed: false, ageBands: [{ label: "25–34", count: 5 }], topInterests: [{ label: "bowling", count: 5 }] });
  });
});
