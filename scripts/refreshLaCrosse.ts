import { writeFile } from "node:fs/promises";
import { scrapeAllLaCrosseEventsWithHealth } from "../server/communityScraper";
import { recordEventSourceHealth, upsertScrapedEvents } from "../server/db";

const result = await scrapeAllLaCrosseEventsWithHealth();
const inserted = await upsertScrapedEvents(result.events);
await Promise.all(result.outcomes.map(recordEventSourceHealth));

const summary = {
  generatedAt: new Date().toISOString(),
  inserted,
  sources: result.outcomes,
  events: result.events.map((event) => ({
    title: event.title,
    eventDate: event.eventDate?.toISOString() ?? null,
    venueName: event.venueName,
    venueCity: event.venueCity,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
  })),
};

await writeFile("research/la-crosse-refresh.json", `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary));
