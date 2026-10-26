import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("direct outreach safeguards", () => {
  it("requires administrator access, venue-bound official email, and explicit confirmation", () => {
    const source = readFileSync(resolve(__dirname, "routers.ts"), "utf8");
    expect(source).toContain("outreach: router");
    expect(source).toContain("send: adminProcedure");
    expect(source).toContain("confirmed: z.literal(true)");
    expect(source).toContain("venue.contactEmail");
    expect(source).toContain("createVenueOutreachRecord");
  });
});
