/**
 * seed-events-now.mjs — seeds fresh events for Milwaukee and Waukesha
 */
import { createConnection } from "mysql2/promise";

const DB_URL = process.env.DATABASE_URL;
const LLM_URL = process.env.BUILT_IN_FORGE_API_URL;
const LLM_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!DB_URL) { console.error("DATABASE_URL not set"); process.exit(1); }
if (!LLM_URL || !LLM_KEY) { console.error("LLM env vars not set"); process.exit(1); }

const CITIES = [
  { city: "Milwaukee", state: "WI" },
  { city: "Waukesha", state: "WI" },
];

const CATEGORIES = ["music", "food", "market", "sports", "arts", "community", "outdoors", "other"];

async function callLLM(prompt) {
  const resp = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LLM_KEY}`,
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku",
      messages: [
        {
          role: "system",
          content: "You are a JSON generator. Return ONLY valid JSON arrays with no markdown fences, no explanation, no extra text. Every string value must be on a single line with no newlines inside string values."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!resp.ok) throw new Error(`LLM API ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function seedCity(conn, city, state) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 60);
  const futureDateStr = futureDate.toISOString().split("T")[0];

  console.log(`\n🏙️  Seeding ${city}, ${state}...`);

  const prompt = `Return a JSON array of 20 community events for ${city}, ${state} between ${todayStr} and ${futureDateStr}.
Each object: {"title":"string","description":"one sentence","category":"music|food|market|sports|arts|community|outdoors|other","eventDate":"2026-08-15T19:00:00","venueName":"string","isFree":true,"priceCents":0}
No markdown. No newlines inside string values. Just the JSON array.`;

  let rawText;
  try {
    rawText = await callLLM(prompt);
  } catch (err) {
    console.log(`  ⚠️  LLM call failed: ${err.message}`);
    return 0;
  }

  // Strip markdown fences if present
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  // Find the JSON array
  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");
  if (startIdx === -1 || endIdx === -1) {
    console.log(`  ⚠️  No JSON array found. Response: ${cleaned.slice(0, 200)}`);
    return 0;
  }

  let jsonStr = cleaned.slice(startIdx, endIdx + 1);
  // Replace literal newlines inside strings (common LLM mistake)
  jsonStr = jsonStr.replace(/:\s*"([^"]*?)"/gs, (match, val) => {
    return `: "${val.replace(/\n/g, " ").replace(/\r/g, "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ")}"`;
  });

  let events;
  try {
    events = JSON.parse(jsonStr);
  } catch (err) {
    console.log(`  ⚠️  JSON parse failed: ${err.message}. Trying line-by-line...`);
    // Last resort: extract objects one by one using a depth-tracking parser
    events = [];
    let depth = 0, start = -1;
    for (let i = 0; i < jsonStr.length; i++) {
      if (jsonStr[i] === "{") { if (depth === 0) start = i; depth++; }
      else if (jsonStr[i] === "}") {
        depth--;
        if (depth === 0 && start !== -1) {
          try {
            const obj = JSON.parse(jsonStr.slice(start, i + 1).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " "));
            events.push(obj);
          } catch {}
          start = -1;
        }
      }
    }
    console.log(`  ℹ️  Extracted ${events.length} events via depth parser`);
  }

  if (!Array.isArray(events) || events.length === 0) {
    console.log(`  ⚠️  No events to insert`);
    return 0;
  }

  const now = new Date();
  let inserted = 0;
  for (const ev of events) {
    try {
      if (!ev.title || !ev.eventDate) continue;
      const eventDate = new Date(ev.eventDate);
      if (isNaN(eventDate.getTime()) || eventDate < now) continue;
      const category = CATEGORIES.includes(ev.category) ? ev.category : "community";
      // Use timestamp-based ID to avoid collisions with purged records
      const externalId = `llm-${city.toLowerCase().replace(/\s+/g,"-")}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

      await conn.execute(
        `INSERT INTO community_events 
         (title, description, category, eventDate, venueName, city, state, isFree, priceCents, source, externalId, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'llm_generated', ?, true, NOW(), NOW())`,
        [
          String(ev.title).slice(0, 255),
          String(ev.description || "").slice(0, 1000),
          category,
          eventDate,
          String(ev.venueName || "").slice(0, 255),
          city,
          state,
          ev.isFree ? 1 : 0,
          Number(ev.priceCents) || 0,
          externalId,
        ]
      );
      inserted++;
    } catch (err) {
      console.log(`  ⚠️  Insert error for "${ev.title}": ${err.message}`);
    }
  }
  console.log(`  ✅ Inserted ${inserted} new events for ${city}`);
  return inserted;
}

async function main() {
  const conn = await createConnection(DB_URL);
  console.log("✅ Connected to database");

  let total = 0;
  for (const { city, state } of CITIES) {
    const count = await seedCity(conn, city, state);
    total += count;
  }

  // Final count
  const now = new Date();
  const [rows] = await conn.execute(
    "SELECT city, COUNT(*) as cnt FROM community_events WHERE eventDate >= ? AND isActive = true GROUP BY city ORDER BY cnt DESC",
    [now]
  );
  console.log("\n📊 Upcoming events by city:");
  for (const row of rows) {
    console.log(`  ${row.city}: ${row.cnt}`);
  }
  console.log(`\n🎉 Done! Inserted ${total} new events total.`);

  await conn.end();
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
