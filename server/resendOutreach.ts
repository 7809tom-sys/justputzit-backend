export type ResendOutreachResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; errorMessage: string };

export async function sendVerifiedOutreachEmail(input: { to: string; subject: string; body: string }): Promise<ResendOutreachResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.OUTREACH_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, errorMessage: "The verified outreach sender is not configured." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.body }),
  });
  const payload = await response.json().catch(() => null) as { id?: string; message?: string; name?: string } | null;
  if (!response.ok || !payload?.id) {
    return { ok: false, errorMessage: payload?.message || payload?.name || `Email provider returned HTTP ${response.status}.` };
  }
  return { ok: true, providerMessageId: payload.id };
}
