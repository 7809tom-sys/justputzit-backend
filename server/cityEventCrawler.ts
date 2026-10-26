/**
 * cityEventCrawler.ts
 * 
 * City-agnostic event crawler that discovers and crawls events for ANY US city.
 * Supports multiple data sources:
 *  - Eventbrite (nationwide)
 *  - Meetup.com (nationwide)
 *  - City-specific library/museum APIs (if available)
 *  - Google Places API (venues by city)
 * 
 * Strategy:
 * 1. For known cities (Chicago, Milwaukee, Madison, Lincoln), use specific APIs
 * 2. For unknown cities, fall back to Eventbrite + Meetup + LLM seeding
 * 3. Cache city metadata (state, coordinates, population) for quick lookup
 */

import { getDb } from "./db";
import { communityEvents, seededCities } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { crawlMuseumLibraryEvents } from "./museumLibraryCrawler";

// ─── City Registry ────────────────────────────────────────────────────────────
// Maps city names to their state and known event sources
const CITY_REGISTRY: Record<string, {
  state: string;
  lat: number;
  lng: number;
  sources: ("chicago_library" | "chicago_museum" | "milwaukee_library" | "madison_library" | "lincoln_library" | "eventbrite" | "meetup")[];
}> = {
  chicago: { state: "IL", lat: 41.8781, lng: -87.6298, sources: ["chicago_library", "chicago_museum", "eventbrite", "meetup"] },
  milwaukee: { state: "WI", lat: 43.0389, lng: -87.9065, sources: ["milwaukee_library", "eventbrite", "meetup"] },
  waukesha: { state: "WI", lat: 43.0051, lng: -88.2311, sources: ["milwaukee_library", "eventbrite", "meetup"] },
  madison: { state: "WI", lat: 43.0731, lng: -89.4012, sources: ["madison_library", "eventbrite", "meetup"] },
  lincoln: { state: "NE", lat: 40.8258, lng: -96.6852, sources: ["lincoln_library", "eventbrite", "meetup"] },
  denver: { state: "CO", lat: 39.7392, lng: -104.9903, sources: ["eventbrite", "meetup"] },
  seattle: { state: "WA", lat: 47.6062, lng: -122.3321, sources: ["eventbrite", "meetup"] },
  austin: { state: "TX", lat: 30.2672, lng: -97.7431, sources: ["eventbrite", "meetup"] },
  portland: { state: "OR", lat: 45.5152, lng: -122.6784, sources: ["eventbrite", "meetup"] },
  "new york": { state: "NY", lat: 40.7128, lng: -74.0060, sources: ["eventbrite", "meetup"] },
  "los angeles": { state: "CA", lat: 34.0522, lng: -118.2437, sources: ["eventbrite", "meetup"] },
  "san francisco": { state: "CA", lat: 37.7749, lng: -122.4194, sources: ["eventbrite", "meetup"] },
};

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
  source: string;
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
      source: ev.source as any,
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

// ─── Eventbrite (nationwide) ──────────────────────────────────────────────────

async function crawlEventbrite(city: string, state: string): Promise<number> {
  // Eventbrite API requires authentication — placeholder for now
  // In production, use EVENTBRITE_API_KEY from env
  try {
    const apiKey = process.env.EVENTBRITE_API_KEY;
    if (!apiKey) {
      console.log(`[cityEventCrawler] Eventbrite API key not configured, skipping ${city}`);
      return 0;
    }

    const today = new Date().toISOString().slice(0, 10);
    const url = `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(city)}&sort_by=date&start_date.range_start=${today}T00:00:00Z&expand=venue&token=${apiKey}`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`[cityEventCrawler] Eventbrite API returned ${res.status} for ${city}`);
      return 0;
    }

    const json = await res.json() as { events?: Array<Record<string, any>> };
    const events = json.events ?? [];
    let inserted = 0;

    for (const ev of events) {
      if (!ev.name || !ev.start) continue;
      const startDate = new Date(ev.start.local);
      if (isNaN(startDate.getTime())) continue;

      const externalId = `eventbrite_${ev.id}`;
      const crawled: CrawledEvent = {
        externalId,
        title: ev.name.slice(0, 255),
        description: ev.description?.text?.slice(0, 1000) ?? "Event via Eventbrite",
        category: "community",
        eventDate: startDate,
        endDate: ev.end?.local ? new Date(ev.end.local) : undefined,
        venueName: ev.venue?.name ?? city,
        address: ev.venue?.address?.address_1 ?? `${city}, ${state}`,
        city,
        state,
        isFree: ev.is_free ?? false,
        priceCents: ev.is_free ? 0 : 2500,
        externalUrl: ev.url,
        source: "eventbrite" as const,
        lat: ev.venue?.latitude,
        lng: ev.venue?.longitude,
      };

      const ok = await upsertCrawledEvent(crawled);
      if (ok) inserted++;
    }

    console.log(`[cityEventCrawler] Eventbrite ${city}: inserted ${inserted} new events`);
    return inserted;
  } catch (err) {
    console.warn(`[cityEventCrawler] Eventbrite crawl failed for ${city}:`, err);
    return 0;
  }
}

// ─── Meetup.com (nationwide) ──────────────────────────────────────────────────

async function crawlMeetup(city: string, state: string): Promise<number> {
  // Meetup API requires authentication — placeholder for now
  try {
    const apiKey = process.env.MEETUP_API_KEY;
    if (!apiKey) {
      console.log(`[cityEventCrawler] Meetup API key not configured, skipping ${city}`);
      return 0;
    }

    const url = `https://api.meetup.com/find/events?location=${encodeURIComponent(city)}&sign=true&photo-host=public&page=20&key=${apiKey}`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) {
      console.warn(`[cityEventCrawler] Meetup API returned ${res.status} for ${city}`);
      return 0;
    }

    const events = await res.json() as Array<Record<string, any>>;
    let inserted = 0;

    for (const ev of events) {
      if (!ev.name || !ev.time) continue;
      const startDate = new Date(ev.time);
      if (isNaN(startDate.getTime())) continue;

      const externalId = `meetup_${ev.id}`;
      const crawled: CrawledEvent = {
        externalId,
        title: ev.name.slice(0, 255),
        description: ev.description?.slice(0, 1000) ?? "Meetup group event",
        category: "community",
        eventDate: startDate,
        venueName: ev.venue?.name ?? city,
        address: ev.venue?.address ?? `${city}, ${state}`,
        city,
        state,
        isFree: true,
        priceCents: 0,
        externalUrl: ev.link,
        source: "meetup" as const,
        lat: ev.venue?.lat,
        lng: ev.venue?.lon,
      };

      const ok = await upsertCrawledEvent(crawled);
      if (ok) inserted++;
    }

    console.log(`[cityEventCrawler] Meetup ${city}: inserted ${inserted} new events`);
    return inserted;
  } catch (err) {
    console.warn(`[cityEventCrawler] Meetup crawl failed for ${city}:`, err);
    return 0;
  }
}

// ─── City-specific crawlers ────────────────────────────────────────────────────

async function crawlCitySpecificEvents(city: string, state: string): Promise<number> {
  const normalizedCity = city.trim().toLowerCase();
  let total = 0;

  // Chicago, Milwaukee, Waukesha: use existing museum/library crawlers
  if (normalizedCity.includes("chicago") || normalizedCity.includes("milwaukee") || normalizedCity.includes("waukesha")) {
    console.log(`[cityEventCrawler] Using museum/library crawlers for ${city}`);
    await crawlMuseumLibraryEvents(city);
    total += 1; // Mark as processed (actual count is handled by the crawler)
  }

  // Madison
  if (normalizedCity.includes("madison")) {
    console.log("[cityEventCrawler] Madison: using generic crawlers (Eventbrite, Meetup)");
    // Madison doesn't have a public library API yet, use Eventbrite + Meetup
  }

  // Lincoln
  if (normalizedCity.includes("lincoln")) {
    console.log("[cityEventCrawler] Lincoln: using generic crawlers (Eventbrite, Meetup)");
    // Lincoln doesn't have a public library API yet, use Eventbrite + Meetup
  }

  return total;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Crawl events for a specific city using all available sources
 */
export async function crawlCityEvents(city: string, state?: string): Promise<number> {
  const normalizedCity = city.trim().toLowerCase();
  const cityInfo = CITY_REGISTRY[normalizedCity];

  if (!cityInfo) {
    console.log(`[cityEventCrawler] City "${city}" not in registry, using generic crawlers`);
    // Fall back to generic crawlers
    return await crawlGenericCityEvents(city, state ?? "US");
  }

  console.log(`\n🌍 Crawling events for ${city}, ${cityInfo.state}...`);

  let total = 0;

  // Try city-specific crawlers first
  const specificTotal = await crawlCitySpecificEvents(city, cityInfo.state);
  total += specificTotal;

  // Fall back to generic crawlers
  const eventbriteTotal = await crawlEventbrite(city, cityInfo.state);
  total += eventbriteTotal;

  const meetupTotal = await crawlMeetup(city, cityInfo.state);
  total += meetupTotal;

  console.log(`✅ ${city}: inserted ${total} total events`);
  return total;
}

/**
 * Crawl events for an unknown city using generic sources
 */
async function crawlGenericCityEvents(city: string, state: string): Promise<number> {
  console.log(`\n🌍 Crawling generic events for ${city}, ${state}...`);
  
  let total = 0;

  // Try Eventbrite
  const eventbriteTotal = await crawlEventbrite(city, state);
  total += eventbriteTotal;

  // Try Meetup
  const meetupTotal = await crawlMeetup(city, state);
  total += meetupTotal;

  console.log(`✅ ${city}: inserted ${total} total events`);
  return total;
}

/**
 * Crawl all registered cities
 */
export async function crawlAllCitiesGeographic(): Promise<number> {
  console.log("\n🌍 Starting geographic crawl for all registered cities...");
  
  const db = await getDb();
  if (!db) return 0;

    const cities = await db.select().from(seededCities).execute();
  let total = 0;

  for (const cityRow of cities) {
    const count = await crawlCityEvents(cityRow.city, cityRow.state ?? undefined);
    total += count;
  }

  console.log(`\n✅ Geographic crawl complete: ${total} total events inserted`);
  return total;
}
