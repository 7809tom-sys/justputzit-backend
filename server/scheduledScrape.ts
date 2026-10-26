/**
 * scheduledScrape.ts
 * Express handler for POST /api/scheduled/scrape-events
 * Triggered nightly by a scheduler (Railway cron) with Authorization: Bearer CRON_SECRET.
 * Scrapes Milwaukee/Waukesha and Madison official community event sources and upserts into DB.
 */

import type { Request, Response } from "express";
import { scrapeAllLaCrosseEventsWithHealth, scrapeAllMadisonEventsWithHealth, scrapeAllMilwaukeeEventsWithHealth } from "./communityScraper";
import { recordEventSourceHealth, upsertScrapedEvents } from "./db";

export async function scrapeEventsHandler(req: Request, res: Response) {
  try {

    console.log(`[scheduledScrape] Starting nightly community event scrape`);

    const [milwaukee, madison, laCrosse] = await Promise.all([
      scrapeAllMilwaukeeEventsWithHealth(),
      scrapeAllMadisonEventsWithHealth(),
      scrapeAllLaCrosseEventsWithHealth(),
    ]);
    const milwaukeeEvents = milwaukee.events;
    const madisonEvents = madison.events;
    const events = [...milwaukeeEvents, ...madisonEvents, ...laCrosse.events];
    console.log(`[scheduledScrape] Scraped ${events.length} total events across Milwaukee/Waukesha, Madison, and La Crosse`);

    const inserted = await upsertScrapedEvents(events);
    const sourceOutcomes = [...milwaukee.outcomes, ...madison.outcomes, ...laCrosse.outcomes];
    await Promise.all(sourceOutcomes.map(recordEventSourceHealth));
    console.log(`[scheduledScrape] Inserted ${inserted} new events`);

    return res.json({
      ok: true,
      scraped: events.length,
      inserted,
      sources: sourceOutcomes,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[scheduledScrape] Error:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.url, taskUid: "unknown" },
      timestamp: new Date().toISOString(),
    });
  }
}
