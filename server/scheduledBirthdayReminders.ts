import type { Request, Response } from "express";
import { createBirthdayMatchNotifications } from "./db";

/**
 * Scheduled endpoint (CRON_SECRET protected) for a once-daily, private birthday reminder pass. It never
 * exposes a full birth date and relies on durable delivery records for retries.
 */
export async function birthdayRemindersHandler(req: Request, res: Response) {
  try {

    const result = await createBirthdayMatchNotifications();
    return res.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[scheduledBirthdayReminders] Error:", error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
