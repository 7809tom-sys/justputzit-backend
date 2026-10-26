import { describe, expect, it } from "vitest";
import {
  buildProfileSummaryEvidence,
  isEvidenceGroundedProfileSummary,
} from "../shared/profileSummaryEvidence";

describe("evidence-grounded Sally profile summaries", () => {
  const evidence = buildProfileSummaryEvidence(
    {
      hobbies: ["songwriting", "cabinetry"],
      personalityKeywords: ["direct", "dry humor"],
      lookingFor: "a local coffee or breakfast date",
      aiSummary: "This prior copy is internal metadata, not evidence.",
    },
    ["I work the overnight factory shift, so I am a daytime regular."],
  );

  it("keeps concrete interview details and member-confirmed traits as available evidence", () => {
    expect(evidence.facts).toContain("songwriting");
    expect(evidence.facts).toContain("cabinetry");
    expect(evidence.facts).toContain("I work the overnight factory shift, so I am a daytime regular.");
    expect(evidence.facts).not.toContain("This prior copy is internal metadata, not evidence.");
  });

  it("accepts a concise summary grounded in multiple specific details", () => {
    expect(isEvidenceGroundedProfileSummary(
      "A daytime regular after overnight factory shifts, he brings dry humor to songwriting and cabinetry. He prefers a direct path to local coffee or breakfast over an endless text thread.",
      evidence,
    )).toBe(true);
  });

  it("rejects generic praise that is unsupported by the member’s evidence", () => {
    expect(isEvidenceGroundedProfileSummary(
      "Everyone, meet an incredible friend with infectious energy and a passion for life. They are always up for an adventure and make every connection vibrant.",
      evidence,
    )).toBe(false);
  });
});
