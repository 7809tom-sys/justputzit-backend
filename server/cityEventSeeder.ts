/**
 * cityEventSeeder.ts
 *
 * When a user signs up in a new city, this module:
 *  1. Checks if the city already has events in the DB.
 *  2. Triggers permitted official-source crawling for the requested city.
 *  3. Geocodes the city only to support city-level discovery metadata.
 *  4. Records the refresh attempt in seeded_cities without publishing generated events.
 *
 * Runs fire-and-forget — never blocks the signup flow.
 */

import { getDb } from "./db";
import { seededCities } from "../drizzle/schema";
import { crawlMuseumLibraryEvents } from "./museumLibraryCrawler";

// ─── Geocoding ────────────────────────────────────────────────────────────────

/** Geocode a city to lat/lng using the Nominatim free API */
async function geocodeCity(city: string, state: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
      { headers: { "User-Agent": "JustPutzit-EventBot/1.0 (contact@justputzit.com)" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function markCitySeeded(
  city: string,
  state: string,
  eventCount: number,
  coords: { lat: number; lng: number } | null
) {
  const db = await getDb();
  if (!db) return;
  try {
    await db
      .insert(seededCities)
      .values({
        city,
        state,
        eventCount,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      .onDuplicateKeyUpdate({
        set: {
          eventCount,
          lastRefreshedAt: new Date(),
          ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        },
      });
  } catch {
    // non-critical
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Call fire-and-forget when a user sets their city.
 * Silently skips if the city already has events.
 */
export async function autoSeedCityEvents(city: string, state = "WI"): Promise<void> {
  if (!city || city.trim().length < 2) return;
  const normalizedCity = city.trim();

  try {
    console.log(`[cityEventSeeder] Refreshing permitted sources for ${normalizedCity}, ${state}`);
    const [coords] = await Promise.all([
      geocodeCity(normalizedCity, state),
      crawlMuseumLibraryEvents(normalizedCity).catch(() => {}),
    ]);

    if (coords) {
      console.log(`[cityEventSeeder] Geocoded ${normalizedCity}: ${coords.lat}, ${coords.lng}`);
    }

    await markCitySeeded(normalizedCity, state, 0, coords);
    console.log(`[cityEventSeeder] Completed permitted-source refresh for ${normalizedCity}; no generated events were published.`);
  } catch (err) {
    console.error(`[cityEventSeeder] Failed to refresh permitted sources for ${normalizedCity}:`, err);
  }
}
