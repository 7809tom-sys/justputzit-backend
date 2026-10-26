import { describe, expect, it } from "vitest";
import { OUTREACH_TEMPLATES, hydrateOutreachTemplate } from "../shared/outreachTemplates";

describe("administrator outreach templates", () => {
  it("provides reviewable venue, fitness, and college arts templates without member-identity claims", () => {
    expect(OUTREACH_TEMPLATES.map((template) => template.id)).toEqual(["community-venue", "fitness-partner", "college-arts"]);
    expect(OUTREACH_TEMPLATES.every((template) => template.body.includes("{venueName}"))).toBe(true);
    expect(OUTREACH_TEMPLATES.every((template) => !template.body.toLowerCase().includes("member names"))).toBe(true);
  });

  it("hydrates only the selected venue context for administrator review", () => {
    expect(hydrateOutreachTemplate("college-arts", { name: "Carroll University", city: "Waukesha" })).toMatchObject({
      subject: expect.stringContaining("Carroll University"),
      body: expect.stringContaining("Waukesha"),
    });
  });
});
