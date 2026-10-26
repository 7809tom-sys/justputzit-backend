import type { NextFunction, Request, Response } from "express";
import { ENV } from "./env";

/**
 * CORS for the split deployment (Vercel frontend, Railway API).
 * Only origins listed in CORS_ORIGINS are allowed. Auth uses a Bearer token, so no
 * cookies cross origins and credentialed requests are not enabled.
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin && ENV.corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      (req.headers["access-control-request-headers"] as string | undefined) ?? "Authorization, Content-Type",
    );
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(origin && ENV.corsOrigins.includes(origin) ? 204 : 403);
    return;
  }
  next();
}
