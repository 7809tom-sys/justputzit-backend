// Why a request was not authenticated, for the deploy logs. Never logs tokens, emails or error messages from the
// database (they can contain row values); only error codes and the failing JWT claim name.

type ErrorLike = { name?: string; code?: unknown; claim?: unknown; message?: string; cause?: unknown; errno?: unknown };

/** "ERR_JWT_CLAIM_VALIDATION_FAILED (claim: iss)", "ER_NO_SUCH_TABLE", "ECONNREFUSED", ... */
export function describeAuthError(error: unknown): string {
  const e = (error ?? {}) as ErrorLike;
  const cause = (e.cause ?? {}) as ErrorLike;
  const code = [cause.code, e.code].find((c): c is string => typeof c === "string" && c.length > 0);
  if (code) {
    const claim = typeof e.claim === "string" ? ` (claim: ${e.claim})` : "";
    return `${code}${claim}`.slice(0, 120);
  }
  // Missing server configuration has a fixed, safe message that names the variable to set.
  if (typeof e.message === "string" && e.message.startsWith("Auth is not configured")) return e.message.slice(0, 120);
  // The app's own errors carry a safe, fixed message (for example "This email is already linked to another sign-in").
  if (e.name === "ForbiddenError" && typeof e.message === "string") return e.message.slice(0, 120);
  return (e.name || "UnknownError").slice(0, 120);
}

const lastLogged = new Map<string, number>();
const REPEAT_AFTER_MS = 60_000;

/** One line per distinct reason per minute, so a polling browser cannot flood the logs. */
export function logAuthFailure(stage: string, error: unknown, now = Date.now()): boolean {
  const line = `[auth] ${stage}: ${describeAuthError(error)}`;
  const previous = lastLogged.get(line);
  if (previous !== undefined && now - previous < REPEAT_AFTER_MS) return false;
  lastLogged.set(line, now);
  console.warn(line);
  return true;
}
