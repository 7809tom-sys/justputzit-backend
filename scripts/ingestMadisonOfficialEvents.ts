import { scrapeAllMadisonEvents } from "../server/communityScraper";
import { upsertScrapedEvents } from "../server/db";

async function main() {
  const events = await scrapeAllMadisonEvents();
  const inserted = await upsertScrapedEvents(events);
  console.log(JSON.stringify({
    scraped: events.length,
    inserted,
    sources: Array.from(new Set(events.map((event) => event.sourceName))),
    samples: events.slice(0, 8).map((event) => ({ title: event.title, date: event.eventDate?.toISOString(), source: event.sourceName })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
