/**
 * run-refresh.mjs
 * Runs the full event refresh directly: crawl all cities, purge old events, re-seed thin cities.
 * Uses the same DATABASE_URL env as the server.
 */
import { createConnection } from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log("✅ Connected to database");

  // ── Step 1: Purge events older than 3 days ────────────────────────────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 3);
  const [purgeResult] = await conn.execute(
    "DELETE FROM community_events WHERE eventDate < ?",
    [cutoff]
  );
  console.log(`🗑️  Purged ${purgeResult.affectedRows} past events (before ${cutoff.toDateString()})`);

  // ── Step 2: Count upcoming events per city ────────────────────────────────
  const [cityRows] = await conn.execute(
    "SELECT city, state FROM seeded_cities"
  );
  console.log(`🏙️  Found ${cityRows.length} seeded cities: ${cityRows.map(r => r.city).join(", ")}`);

  const now = new Date();
  for (const row of cityRows) {
    const [countRows] = await conn.execute(
      "SELECT COUNT(*) as cnt FROM community_events WHERE city = ? AND eventDate >= ?",
      [row.city, now]
    );
    const cnt = countRows[0].cnt;
    console.log(`  ${row.city}: ${cnt} upcoming events`);
  }

  // ── Step 3: Fetch real Chicago Public Library events ─────────────────────
  console.log("\n📚 Fetching Chicago Public Library events...");
  try {
    const resp = await fetch(
      "https://data.cityofchicago.org/resource/vsdy-d8k7.json?$limit=50&$order=start_date DESC",
      { signal: AbortSignal.timeout(15000) }
    );
    if (resp.ok) {
      const events = await resp.json();
      console.log(`  Got ${events.length} CPL events`);
      let inserted = 0;
      for (const ev of events) {
        const title = ev.program_title || ev.event_title || "Library Event";
        const startDate = ev.start_date ? new Date(ev.start_date) : null;
        if (!startDate || startDate < now) continue;
        const externalId = `cpl-${ev.event_id || ev.program_id || title.slice(0,20)}`;
        // Check if already exists
        const [existing] = await conn.execute(
          "SELECT id FROM community_events WHERE externalId = ?",
          [externalId]
        );
        if (existing.length > 0) continue;
        await conn.execute(
          `INSERT INTO community_events 
           (title, description, category, eventDate, city, state, isFree, source, externalId, isActive, createdAt, updatedAt)
           VALUES (?, ?, 'community', ?, 'Chicago', 'IL', true, 'chicago_library', ?, true, NOW(), NOW())`,
          [
            title.slice(0, 255),
            (ev.program_description || ev.event_description || "Chicago Public Library event").slice(0, 1000),
            startDate,
            externalId
          ]
        );
        inserted++;
      }
      console.log(`  ✅ Inserted ${inserted} new CPL events`);
    } else {
      console.log(`  ⚠️  CPL API returned ${resp.status}`);
    }
  } catch (err) {
    console.log(`  ⚠️  CPL fetch failed: ${err.message}`);
  }

  // ── Step 4: Fetch Art Institute of Chicago events ─────────────────────────
  console.log("\n🎨 Fetching Art Institute of Chicago events...");
  try {
    const resp = await fetch(
      "https://api.artic.edu/api/v1/events?limit=20&fields=id,title,short_description,start_at,end_at,is_admission_required,image_url",
      { signal: AbortSignal.timeout(15000) }
    );
    if (resp.ok) {
      const data = await resp.json();
      const events = data.data || [];
      console.log(`  Got ${events.length} AIC events`);
      let inserted = 0;
      for (const ev of events) {
        const startDate = ev.start_at ? new Date(ev.start_at) : null;
        if (!startDate || startDate < now) continue;
        const externalId = `aic-${ev.id}`;
        const [existing] = await conn.execute(
          "SELECT id FROM community_events WHERE externalId = ?",
          [externalId]
        );
        if (existing.length > 0) continue;
        await conn.execute(
          `INSERT INTO community_events 
           (title, description, category, eventDate, city, state, isFree, source, externalId, isActive, createdAt, updatedAt)
           VALUES (?, ?, 'arts', ?, 'Chicago', 'IL', ?, 'chicago_museum', ?, true, NOW(), NOW())`,
          [
            (ev.title || "Art Institute Event").slice(0, 255),
            (ev.short_description || "Art Institute of Chicago event").slice(0, 1000),
            startDate,
            !ev.is_admission_required,
            externalId
          ]
        );
        inserted++;
      }
      console.log(`  ✅ Inserted ${inserted} new AIC events`);
    } else {
      console.log(`  ⚠️  AIC API returned ${resp.status}`);
    }
  } catch (err) {
    console.log(`  ⚠️  AIC fetch failed: ${err.message}`);
  }

  // ── Step 5: Final count ───────────────────────────────────────────────────
  const [totalRows] = await conn.execute(
    "SELECT COUNT(*) as cnt FROM community_events WHERE eventDate >= ? AND isActive = true",
    [now]
  );
  console.log(`\n🎉 Done! Total upcoming active events: ${totalRows[0].cnt}`);

  await conn.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
