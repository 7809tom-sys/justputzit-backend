import { timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { ENV } from "./env";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Guards /api/scheduled/*. Callers (e.g. Railway cron) must send
 * `Authorization: Bearer ${CRON_SECRET}`. With no CRON_SECRET configured every call is refused.
 */
export function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  if (!ENV.cronSecret) {
    res.status(503).json({ error: "Scheduled jobs are not configured" });
    return;
  }
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match || !safeEqual(match[1].trim(), ENV.cronSecret)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
