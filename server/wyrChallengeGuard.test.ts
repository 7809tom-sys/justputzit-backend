import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Would You Rather challenge invitation guard", () => {
  it("requires an existing match and the matched other member before creating a challenge", () => {
    const source = readFileSync(resolve(__dirname, "./routers.ts"), "utf8");
    expect(source).toContain('input(z.object({ challengedId: z.number(), matchId: z.number() }))');
    expect(source).toContain("const match = await getMatchById(input.matchId)");
    expect(source).toContain("otherMemberId !== input.challengedId");
    expect(source).toContain("Challenges can only be sent to an existing match.");
  });
});
