export const WEBAUTHN_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export function getWebauthnChallengeExpiry(now = new Date()) {
  return new Date(now.getTime() + WEBAUTHN_CHALLENGE_TTL_MS);
}

export function isUsableWebauthnChallenge(input: { expiresAt: Date; consumedAt: Date | null }, now = new Date()) {
  return input.consumedAt === null && input.expiresAt.getTime() > now.getTime();
}
