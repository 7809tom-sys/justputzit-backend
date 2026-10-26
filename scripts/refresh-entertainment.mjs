import { scrapeClub400Entertainment, scrapeLaughingTapComedy, scrapeMilwaukeeComedy, scrapeMilwaukeeImprov } from "../server/communityScraper.ts";
import { upsertScrapedEvents } from "../server/db.ts";

const sources = await Promise.allSettled([
  scrapeClub400Entertainment(),
  scrapeMilwaukeeComedy(),
  scrapeLaughingTapComedy(),
  scrapeMilwaukeeImprov(),
]);

const events = sources.flatMap((result) => result.status === "fulfilled" ? result.value : []);
const sourceCounts = sources.map((result, index) => ({
  source: ["Club 400", "Milwaukee Comedy", "The Laughing Tap", "Milwaukee Improv"][index],
  events: result.status === "fulfilled" ? result.value.length : 0,
}));
const failures = sources
  .filter((result) => result.status === "rejected")
  .map((result) => String(result.reason instanceof Error ? result.reason.message : result.reason));

const inserted = await upsertScrapedEvents(events);
console.log(JSON.stringify({ scraped: events.length, inserted, sourceCounts, failures }, null, 2));
process.exit(0);
