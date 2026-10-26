/**
 * add-waukesha-library-events.mjs
 * Manually insert the Waukesha Public Library events from the Google Business Profile screenshot
 */
import { createConnection } from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const EVENTS = [
  {
    title: "Carnegie Series: Chapters of Our Community",
    description: "Join us for the Carnegie Series exploring chapters of our community.",
    category: "arts",
    eventDate: new Date("2026-08-14T14:00:00"),
    venueName: "Waukesha Public Library",
    address: "Waukesha, WI",
    isFree: true,
  },
  {
    title: "Fueling for an Active Lifestyle",
    description: "Learn about nutrition and wellness for an active lifestyle.",
    category: "community",
    eventDate: new Date("2026-08-17T18:00:00"),
    venueName: "Waukesha Public Library",
    address: "Waukesha, WI",
    isFree: true,
  },
  {
    title: "Trail Running Film Festival",
    description: "Experience inspiring trail running films at the library.",
    category: "sports",
    eventDate: new Date("2026-08-18T18:00:00"),
    venueName: "Waukesha Public Library",
    address: "Waukesha, WI",
    isFree: true,
  },
  {
    title: "Ready, Set, School!",
    description: "Prepare for the school year with library resources and activities.",
    category: "community",
    eventDate: new Date("2026-08-19T10:00:00"),
    venueName: "Waukesha Public Library",
    address: "Waukesha, WI",
    isFree: true,
  },
  {
    title: "Lunch and Learn Book Club",
    description: "Join our monthly book club for lunch and discussion.",
    category: "community",
    eventDate: new Date("2026-09-08T12:00:00"),
    venueName: "Waukesha Public Library",
    address: "Waukesha, WI",
    isFree: true,
  },
];

async function main() {
  const conn = await createConnection(DB_URL);
  console.log("✅ Connected to database\n");

  let inserted = 0;
  for (const ev of EVENTS) {
    try {
      const externalId = `wpl-google-${ev.title.toLowerCase().replace(/\s+/g, "-").slice(0, 30)}-${ev.eventDate.getTime()}`;
      
      // Check if already exists
      const [existing] = await conn.execute(
        "SELECT id FROM community_events WHERE externalId = ?",
        [externalId]
      );
      if (existing.length > 0) {
        console.log(`⏭️  Skipped "${ev.title}" (already exists)`);
        continue;
      }

      await conn.execute(
        `INSERT INTO community_events 
         (title, description, category, eventDate, venueName, address, city, state, isFree, priceCents, source, externalId, isActive, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, 'Waukesha', 'WI', ?, 0, 'waukesha_library', ?, true, NOW())`,
        [
          ev.title,
          ev.description,
          ev.category,
          ev.eventDate,
          ev.venueName,
          ev.address,
          ev.isFree ? 1 : 0,
          externalId,
        ]
      );
      console.log(`✅ Added "${ev.title}" — ${ev.eventDate.toDateString()}`);
      inserted++;
    } catch (err) {
      console.log(`❌ Error adding "${ev.title}": ${err.message}`);
    }
  }

  // Show final count
  const [rows] = await conn.execute(
    "SELECT city, COUNT(*) as cnt FROM community_events WHERE eventDate >= NOW() AND isActive = true GROUP BY city ORDER BY cnt DESC"
  );
  console.log("\n📊 Upcoming events by city:");
  for (const row of rows) {
    console.log(`  ${row.city}: ${row.cnt}`);
  }
  console.log(`\n🎉 Done! Inserted ${inserted} Waukesha library events.`);

  await conn.end();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
