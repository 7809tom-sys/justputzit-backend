import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Team Builder profile-learning policy", () => {
  it("does not infer member traits from cooperative choices or group consensus", () => {
    const routerSource = readFileSync(resolve(__dirname, "routers.ts"), "utf8");
    expect(routerSource).toContain('room.gameType !== "team_builder" && room.questions');
    expect(routerSource).toContain("extractTraitsFromGameplay");
  });
});
