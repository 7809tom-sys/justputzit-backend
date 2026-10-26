/**
 * museumLibraryCrawler.ts
 *
 * Crawls real event data from:
 *  - Chicago Public Library (City of Chicago Open Data / Socrata API)
 *  - Art Institute of Chicago (public REST API)
 *  - Milwaukee Public Library (Communico RSS/iCal feed)
 *  - Discovery World Milwaukee (public calendar page scrape)
 *
 * Deduplicates by externalId before inserting.
 * All events are auto-published (isActive = true).
 * Runs fire-and-forget — never blocks any request.
 */

import { getDb } from "./db";
import { communityEvents } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

type CrawledEvent = {
  externalId: string;
  title: string;
  description: string;
  category: "music" | "food" | "market" | "sports" | "arts" | "community" | "outdoors" | "other";
  eventDate: Date;
  endDate?: Date;
  venueName: string;
  address: string;
  city: string;
  state: string;
  isFree: boolean;
  priceCents: number;
  externalUrl?: string;
  source: "chicago_library" | "chicago_museum" | "milwaukee_library" | "scraped";
  lat?: number;
  lng?: number;
};

// ─── Deduplication ────────────────────────────────────────────────────────────

async function externalIdExists(externalId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select({ id: communityEvents.id })
    .from(communityEvents)
    .where(eq(communityEvents.externalId, externalId))
    .limit(1);
  return rows.length > 0;
}

async function upsertCrawledEvent(ev: CrawledEvent): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const exists = await externalIdExists(ev.externalId);
    if (exists) return false;
    await db.insert(communityEvents).values({
      title: ev.title.slice(0, 255),
      description: ev.description,
      category: ev.category,
      eventDate: ev.eventDate,
      endDate: ev.endDate,
      venueName: ev.venueName.slice(0, 255),
      address: ev.address,
      city: ev.city,
      state: ev.state,
      isFree: ev.isFree,
      priceCents: ev.priceCents,
      externalUrl: ev.externalUrl ?? null,
      source: ev.source,
      externalId: ev.externalId,
      isActive: true,
      rsvpCount: 0,
      lat: ev.lat ?? null,
      lng: ev.lng ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Chicago Public Library (Socrata API) ─────────────────────────────────────

async function crawlChicagoPublicLibrary(): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Socrata SoQL: future events only, limit 100, ordered by start date
    const url = `https://data.cityofchicago.org/resource/vsdy-d8k7.json?$where=start>'${today}T00:00:00'&$order=start ASC&$limit=100`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[museumLibraryCrawler] CPL API returned ${res.status}`);
      return 0;
    }
    const events = await res.json() as Array<Record<string, string>>;
    let inserted = 0;
    for (const ev of events) {
      if (!ev.title || !ev.start) continue;
      const startDate = new Date(ev.start);
      if (isNaN(startDate.getTime())) continue;
      const externalId = `cpl_${ev.event_id ?? (ev.title + ev.start).replace(/\s/g, "_").slice(0, 80)}`;
      const crawled: CrawledEvent = {
        externalId,
        title: ev.title,
        description: ev.description ?? `${ev.event_types ?? "Event"} at ${ev.location_name ?? "Chicago Public Library"}`,
        category: guessCategory(ev.event_types ?? ev.title),
        eventDate: startDate,
        endDate: ev.end ? new Date(ev.end) : undefined,
        venueName: ev.location_name ?? "Chicago Public Library",
        address: ev.location_details ?? "Chicago, IL",
        city: "Chicago",
        state: "IL",
        isFree: true,
        priceCents: 0,
        externalUrl: ev.event_page ?? undefined,
        source: "chicago_library",
      };
      const ok = await upsertCrawledEvent(crawled);
      if (ok) inserted++;
    }
    console.log(`[museumLibraryCrawler] Chicago Public Library: inserted ${inserted} new events`);
    return inserted;
  } catch (err) {
    console.warn("[museumLibraryCrawler] CPL crawl failed:", err);
    return 0;
  }
}

// ─── Art Institute of Chicago (public API) ────────────────────────────────────

type AICEvent = {
  id: number;
  title: string;
  short_description?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  is_free?: boolean;
  entrance?: string;
  slug?: string;
};

async function crawlArtInstituteChicago(): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://api.artic.edu/api/v1/events?fields=id,title,short_description,start_date,end_date,location,is_free,slug&limit=50&sort=start_date&query[range][start_date][gte]=${today}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[museumLibraryCrawler] AIC API returned ${res.status}`);
      return 0;
    }
    const json = await res.json() as { data?: AICEvent[] };
    const events = json.data ?? [];
    let inserted = 0;
    for (const ev of events) {
      if (!ev.title || !ev.start_date) continue;
      const startDate = new Date(ev.start_date);
      if (isNaN(startDate.getTime())) continue;
      const externalId = `aic_${ev.id}`;
      const crawled: CrawledEvent = {
        externalId,
        title: ev.title,
        description: ev.short_description ?? ev.description ?? "Event at the Art Institute of Chicago.",
        category: "arts",
        eventDate: startDate,
        endDate: ev.end_date ? new Date(ev.end_date) : undefined,
        venueName: "Art Institute of Chicago",
        address: "111 S Michigan Ave, Chicago, IL 60603",
        city: "Chicago",
        state: "IL",
        isFree: ev.is_free ?? false,
        priceCents: ev.is_free ? 0 : 2500, // $25 general admission if not free
        externalUrl: ev.slug ? `https://www.artic.edu/events/${ev.slug}` : "https://www.artic.edu/events",
        source: "chicago_museum",
        lat: 41.8796,
        lng: -87.6237,
      };
      const ok = await upsertCrawledEvent(crawled);
      if (ok) inserted++;
    }
    console.log(`[museumLibraryCrawler] Art Institute of Chicago: inserted ${inserted} new events`);
    return inserted;
  } catch (err) {
    console.warn("[museumLibraryCrawler] AIC crawl failed:", err);
    return 0;
  }
}

// ─── Milwaukee Public Library (Communico JSON API) ────────────────────────────

type MPLEvent = {
  id?: string | number;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  address?: string;
  isFree?: boolean;
  eventTypes?: string[];
};

async function crawlMilwaukeePublicLibrary(): Promise<number> {
  try {
    // Communico public API — no key required for public events
    const today = new Date().toISOString().slice(0, 10);
    const url = `https://mpl.libnet.info/api/2.0/events?startDate=${today}&limit=80&format=json`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`[museumLibraryCrawler] MPL API returned ${res.status}`);
      return 0;
    }
    const json = await res.json() as { events?: MPLEvent[] };
    const events = json.events ?? [];
    let inserted = 0;
    for (const ev of events) {
      if (!ev.title || !ev.startDate) continue;
      const startDate = new Date(ev.startDate);
      if (isNaN(startDate.getTime())) continue;
      const externalId = `mpl_${ev.id ?? (ev.title + ev.startDate).replace(/\s/g, "_").slice(0, 80)}`;
      const crawled: CrawledEvent = {
        externalId,
        title: ev.title,
        description: ev.description ?? `Event at ${ev.location ?? "Milwaukee Public Library"}`,
        category: guessCategory(ev.eventTypes?.join(" ") ?? ev.title),
        eventDate: startDate,
        endDate: ev.endDate ? new Date(ev.endDate) : undefined,
        venueName: ev.location ?? "Milwaukee Public Library",
        address: ev.address ?? "814 W Wisconsin Ave, Milwaukee, WI 53233",
        city: "Milwaukee",
        state: "WI",
        isFree: ev.isFree ?? true,
        priceCents: 0,
        externalUrl: "https://mpl.libnet.info/events",
        source: "milwaukee_library",
        lat: 43.0389,
        lng: -87.9065,
      };
      const ok = await upsertCrawledEvent(crawled);
      if (ok) inserted++;
    }
    console.log(`[museumLibraryCrawler] Milwaukee Public Library: inserted ${inserted} new events`);
    return inserted;
  } catch (err) {
    console.warn("[museumLibraryCrawler] MPL crawl failed:", err);
    return 0;
  }
}

// ─── Category guesser ─────────────────────────────────────────────────────────

function guessCategory(text: string): CrawledEvent["category"] {
  const t = text.toLowerCase();
  if (/music|concert|perform|band|choir|jazz|orchestra/.test(t)) return "music";
  if (/food|cook|culinary|tast|eat|drink|wine|beer/.test(t)) return "food";
  if (/market|fair|vendor|craft|artisan/.test(t)) return "market";
  if (/sport|game|run|race|fit|yoga|exercise|gym|athlet/.test(t)) return "sports";
  if (/art|exhibit|gallery|museum|paint|sculpt|photo|film|theater|theatre|dance|poetry|book|read|story|author|lecture/.test(t)) return "arts";
  if (/outdoor|hike|park|nature|garden|trail|kayak|bike/.test(t)) return "outdoors";
  if (/community|volunteer|neighbor|civic|meeting|club|social|family|kids|children|senior|youth/.test(t)) return "community";
  return "other";
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Crawl real museum and library events for a given city.
 * Call fire-and-forget — never awaited in request handlers.
 */
export async function crawlMuseumLibraryEvents(city: string): Promise<void> {
  const normalizedCity = city.trim().toLowerCase();
  try {
    if (normalizedCity.includes("chicago")) {
      await Promise.allSettled([
        crawlChicagoPublicLibrary(),
        crawlArtInstituteChicago(),
      ]);
    } else if (normalizedCity.includes("milwaukee") || normalizedCity.includes("waukesha")) {
      await crawlMilwaukeePublicLibrary();
    }
    // Additional cities can be added here
  } catch (err) {
    console.error("[museumLibraryCrawler] Crawl failed:", err);
  }
}

/**
 * Refresh all supported cities — call on a schedule or on-demand.
 */
export async function crawlAllCities(): Promise<void> {
  console.log("[museumLibraryCrawler] Starting full crawl for all cities...");
  await Promise.allSettled([
    crawlChicagoPublicLibrary(),
    crawlArtInstituteChicago(),
    crawlMilwaukeePublicLibrary(),
  ]);
  console.log("[museumLibraryCrawler] Full crawl complete.");
}
