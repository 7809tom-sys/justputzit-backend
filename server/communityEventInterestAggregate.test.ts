import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Community Event interest aggregate", () => {
  const source = readFileSync(resolve(__dirname, "db.ts"), "utf8");

  it("returns a count without joining or selecting member identity fields", () => {
    const eventListSection = source.slice(source.indexOf("export async function getCommunityEvents"), source.indexOf("export async function archiveExpiredUnreferencedCommunityEvents"));
    expect(eventListSection).toContain("COUNT(*)");
    expect(eventListSection).toContain('as("interestCount")');
    expect(eventListSection).not.toContain("users.name");
    expect(eventListSection).not.toContain("userProfiles.displayName");
  });
});
