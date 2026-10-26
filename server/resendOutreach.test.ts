import { afterEach, describe, expect, it, vi } from "vitest";
import { sendVerifiedOutreachEmail } from "./resendOutreach";

const originalFetch = global.fetch;
const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.OUTREACH_FROM_EMAIL;

afterEach(() => {
  global.fetch = originalFetch;
  process.env.RESEND_API_KEY = originalKey;
  process.env.OUTREACH_FROM_EMAIL = originalFrom;
});

describe("verified outreach delivery", () => {
  it("uses the configured branded sender and returns only the provider message identifier", async () => {
    process.env.RESEND_API_KEY = "test-key";
    process.env.OUTREACH_FROM_EMAIL = "support@justputzit.com";
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "provider-message-1" }) }) as unknown as typeof fetch;
    await expect(sendVerifiedOutreachEmail({ to: "venue@example.com", subject: "Hello", body: "A reviewable outreach message." })).resolves.toEqual({ ok: true, providerMessageId: "provider-message-1" });
    expect(global.fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
  });

  it("returns a non-sending failure state when provider configuration is absent", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.OUTREACH_FROM_EMAIL;
    await expect(sendVerifiedOutreachEmail({ to: "venue@example.com", subject: "Hello", body: "A reviewable outreach message." })).resolves.toMatchObject({ ok: false });
  });
});
