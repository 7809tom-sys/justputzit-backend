import { describe, expect, it } from "vitest";

describe("Resend outreach credential", () => {
  it("authenticates to the non-sending domains endpoint", async () => {
    const apiKey = process.env.RESEND_API_KEY;
    expect(apiKey, "RESEND_API_KEY must be configured for direct outreach").toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    expect(response.ok, "Resend credential must authenticate to the domains endpoint").toBe(true);
    const body = await response.json() as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  }, 15_000);
});
