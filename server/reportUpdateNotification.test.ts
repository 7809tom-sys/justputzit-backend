import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("private safety report follow-up", () => {
  it("uses a reporter-only notification without exposing moderation actions", () => {
    const root = resolve(__dirname, "..");
    const dbSource = readFileSync(resolve(root, "server/db.ts"), "utf8");
    expect(dbSource).toContain('"report_update"');
    expect(dbSource).toContain("report.reporterId");
    expect(dbSource).toContain("we can’t share any action taken");
    expect(dbSource).not.toContain("report.reportedUserId,\n      \"report_update\"");
  });
});
