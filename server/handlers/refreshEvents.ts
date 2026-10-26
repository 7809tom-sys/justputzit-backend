/**
 * refreshEvents.ts
 *
 * Scheduled handler: POST /api/scheduled/refresh-events
 *
 * Runs on a schedule (e.g. every 6 hours) to keep the community event feed fresh:
 *  1. Crawl all supported cities' real-data sources (Chicago Public Library,
 *     Art Institute of Chicago, Milwaukee Public Library).
 *  2. Purge community_events rows whose eventDate is more than 3 days in the past.
 *  3. Re-seed any city in seeded_cities that has fewer than 10 upcoming events.
 *
 * Auth: requireCronSecret middleware (Authorization: Bearer CRON_SECRET).
 */

import type { Request, Response } from "express";
import { archiveExpiredUnreferencedCommunityEvents, getDb } from "../db";
import { communityEvents, seededCities } from "../../drizzle/schema";
import { and, gte, eq, count } from "drizzle-orm";
import { crawlAllCitiesGeographic } from "../cityEventCrawler";
import { autoSeedCityEvents } from "../cityEventSeeder";
import { shouldReseedCity } from "../../shared/cityRefreshPolicy";

export async function refreshEventsHandler(req: Request, res: Response) {
  try {

    const db = await getDb();
    if (!db) {
      return res.status(500).json({ error: "DB unavailable" });
    }

    const startTime = Date.now();
    const results: Record<string, unknown> = {};

    // ── Step 1: Crawl all real-data sources ──────────────────────────────────
    console.log("[refreshEvents] Starting geographic crawl for all seeded cities...");
    const crawlCount = await crawlAllCitiesGeographic();
    results.crawlComplete = true;
    results.eventsInserted = crawlCount;
    console.log(`[refreshEvents] Crawl complete: ${crawlCount} events inserted.`);

    // ── Step 2: Archive unreferenced past events (older than 3 days) ──────────
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);

    const retention = await archiveExpiredUnreferencedCommunityEvents(cutoff);
    results.archivedEvents = retention.archived;
    results.preservedHistoricalEvents = retention.preserved;
    console.log(`[refreshEvents] Archived ${retention.archived} unreferenced events and preserved ${retention.preserved} member-history events (before ${cutoff.toISOString()})`);

    // ── Step 3: Re-seed thin cities ───────────────────────────────────────────
    const seeded = await db.select().from(seededCities);
    const now = new Date();
    const reseeded: string[] = [];

    for (const cityRow of seeded) {
      // Count upcoming events for this city
      const [{ cnt }] = await db
        .select({ cnt: count() })
        .from(communityEvents)
        .where(and(
          gte(communityEvents.eventDate, now),
          eq(communityEvents.city, cityRow.city),
          ...(cityRow.state ? [eq(communityEvents.state, cityRow.state)] : []),
        ));

      // If fewer than 10 upcoming events, re-seed
      if (shouldReseedCity(Number(cnt ?? 0))) {
        console.log(`[refreshEvents] City ${cityRow.city} has only ${cnt} upcoming events — re-seeding...`);
        autoSeedCityEvents(cityRow.city, cityRow.state ?? "WI").catch(() => {});
        reseeded.push(cityRow.city);
      }
    }

    results.reseededCities = reseeded;
    results.durationMs = Date.now() - startTime;

    console.log(`[refreshEvents] Done in ${results.durationMs}ms`, results);
    return res.json({ ok: true, ...results });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[refreshEvents] Handler error:", err);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
