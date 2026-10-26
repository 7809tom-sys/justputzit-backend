import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getSallyBehaviorReviewCue } from "../shared/sallyBehaviorReviewPolicy";

describe("Sally behavioral review policy", () => {
  it("only produces a review cue after sustained repeated or low-signal user turns", () => {
    const normalConversation = ["I enjoy hiking", "Sunday brunch", "I would like a local book club", "I am free after work", "Coffee sounds good"]
      .map((content) => ({ role: "user" as const, content }));
    expect(getSallyBehaviorReviewCue(normalConversation)).toBeNull();
    expect(getSallyBehaviorReviewCue(["ok", "yes", "ok", "no", "ok"].map((content) => ({ role: "user" as const, content })))).toBeTruthy();
    expect(getSallyBehaviorReviewCue(["copy", "copy", "copy", "copy", "copy"].map((content) => ({ role: "user" as const, content })))).toContain("Repeated");
  });

  it("keeps behavioral review flags private and non-punitive", () => {
    const root = resolve(__dirname, "..");
    const db = readFileSync(resolve(root, "server/db.ts"), "utf8");
    const router = readFileSync(resolve(root, "server/routers.ts"), "utf8");
    expect(db).toContain("Review only; no account action was taken automatically.");
    expect(db).not.toContain("createSallyBehaviorReviewFlag(userId, reason) {\n  await banUser");
    expect(router).toContain("getSallyBehaviorReviewCue(messages)");
  });
});
