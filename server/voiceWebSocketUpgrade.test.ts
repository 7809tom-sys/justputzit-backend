import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isVoiceSignalUpgradePath } from "./voiceUpload";

describe("voice signaling WebSocket upgrade handling", () => {
  it("handles only the voice signaling route", () => {
    expect(isVoiceSignalUpgradePath("/api/voice/signal")).toBe(true);
    expect(isVoiceSignalUpgradePath("/api/voice/signal?matchId=7")).toBe(true);
    expect(isVoiceSignalUpgradePath("/")).toBe(false);
    expect(isVoiceSignalUpgradePath("/?token=vite-token")).toBe(false);
  });

  it("uses a route-scoped noServer handler so Vite HMR remains available", () => {
    const source = readFileSync(resolve(__dirname, "voiceUpload.ts"), "utf8");
    expect(source).toContain("new WebSocketServer({ noServer: true })");
    expect(source).toContain("if (!isVoiceSignalUpgradePath(req.url)) return;");
  });
});
