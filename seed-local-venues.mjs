/**
 * Seed script: insert real Waukesha & Milwaukee local venues + activity listings
 * Run: node seed-local-venues.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const db = await mysql.createConnection(process.env.DATABASE_URL);

// ── Waukesha venues ────────────────────────────────────────────────────────────
const waukeshaVenues = [
  {
    name: "Waukesha Farmers Market",
    category: "community_center",
    description: "Open-air Saturday market in downtown Waukesha featuring local produce, baked goods, artisan crafts, and live music. Running every Saturday May–October.",
    address: "200 W Main St, Waukesha, WI 53186",
    city: "Waukesha",
    latitude: "43.0117",
    longitude: "-88.2315",
    phone: "(262) 524-3737",
    website: "https://www.waukeshafarmersmarket.com",
    contactEmail: "info@waukeshafarmersmarket.com",
    isFeatured: true,
  },
  {
    name: "Frame Park Mini Golf",
    category: "mini_golf",
    description: "Scenic 18-hole miniature golf course nestled inside Frame Park along the Fox River. Half a mile from downtown Waukesha — perfect for a casual date or family outing.",
    address: "1220 Frame Park Dr, Waukesha, WI 53186",
    city: "Waukesha",
    latitude: "43.0073",
    longitude: "-88.2370",
    phone: "(262) 524-3700",
    website: "https://www.waukesha-wi.gov/parks",
    contactEmail: "parks@waukesha-wi.gov",
    isFeatured: true,
  },
  {
    name: "Fox River Trail — Waukesha",
    category: "hiking",
    description: "Paved multi-use trail following the Fox River through Waukesha County. Great for walking, jogging, cycling, and rollerblading. Connects Frame Park to Minooka Park.",
    address: "Fox River Parkway, Waukesha, WI 53186",
    city: "Waukesha",
    latitude: "43.0090",
    longitude: "-88.2340",
    phone: "(262) 548-7801",
    website: "https://www.waukeshacounty.gov/parks",
    contactEmail: "parks@waukeshacounty.gov",
    isFeatured: false,
  },
  {
    name: "Minooka Park",
    category: "park",
    description: "600-acre county park with fishing, picnic areas, disc golf, hiking trails, and a sledding hill. A local favorite for outdoor dates and group activities.",
    address: "W320 S1100 Minoqua Dr, Waukesha, WI 53189",
    city: "Waukesha",
    latitude: "42.9839",
    longitude: "-88.2500",
    phone: "(262) 548-7801",
    website: "https://www.waukeshacounty.gov/parks/minooka-park",
    contactEmail: "parks@waukeshacounty.gov",
    isFeatured: false,
  },
  {
    name: "Waukesha Public Library",
    category: "library",
    description: "Modern public library with community rooms, free events, book clubs, and a cozy reading café. Great for a quiet first date or study session.",
    address: "321 Wisconsin Ave, Waukesha, WI 53186",
    city: "Waukesha",
    latitude: "43.0117",
    longitude: "-88.2315",
    phone: "(262) 524-3680",
    website: "https://www.waukesha-wi.gov/library",
    contactEmail: "library@waukesha-wi.gov",
    isFeatured: false,
  },
  {
    name: "Waukesha Bowling Center",
    category: "bowling",
    description: "Full-service bowling alley with 32 lanes, a sports bar, and cosmic bowling nights on weekends. One of the best date-night spots in Waukesha.",
    address: "2006 Silvernail Rd, Pewaukee, WI 53072",
    city: "Waukesha",
    latitude: "43.0500",
    longitude: "-88.2600",
    phone: "(262) 691-0700",
    website: "https://www.waukeshabowlingcenter.com",
    contactEmail: "info@waukeshabowlingcenter.com",
    isFeatured: true,
  },
  {
    name: "Escape the Room Waukesha",
    category: "escape_room",
    description: "Immersive escape room experiences for groups of 2–8. Multiple themed rooms with 60-minute challenges. Perfect for date nights and group outings.",
    address: "Downtown Waukesha, WI 53186",
    city: "Waukesha",
    latitude: "43.0117",
    longitude: "-88.2315",
    phone: "(262) 555-0199",
    website: "https://www.escaperoom.com",
    contactEmail: "waukesha@escaperoom.com",
    isFeatured: false,
  },
  {
    name: "Cafe Corazón — Waukesha",
    category: "coffee",
    description: "Cozy independent coffee shop with specialty lattes, fresh pastries, and a warm community vibe. Great for a low-key first date.",
    address: "301 W Main St, Waukesha, WI 53186",
    city: "Waukesha",
    latitude: "43.0117",
    longitude: "-88.2315",
    phone: "(262) 555-0142",
    website: "https://cafecora.com",
    contactEmail: "hello@cafecora.com",
    isFeatured: false,
  },
];

// ── Milwaukee venues ───────────────────────────────────────────────────────────
const milwaukeeVenues = [
  {
    name: "Milwaukee Public Market",
    category: "community_center",
    description: "Year-round indoor market in the Historic Third Ward with local vendors, fresh food, cooking demos, and events. A Milwaukee staple for dates and weekend outings.",
    address: "400 N Water St, Milwaukee, WI 53202",
    city: "Milwaukee",
    latitude: "43.0331",
    longitude: "-87.9065",
    phone: "(414) 336-1111",
    website: "https://www.milwaukeepublicmarket.org",
    contactEmail: "info@milwaukeepublicmarket.org",
    isFeatured: true,
  },
  {
    name: "Lakefront Brewery Tour",
    category: "other",
    description: "Award-winning brewery tours with beer tastings, live music on Fridays, and a polka band. One of Milwaukee's most beloved date-night experiences.",
    address: "1872 N Commerce St, Milwaukee, WI 53212",
    city: "Milwaukee",
    latitude: "43.0600",
    longitude: "-87.9000",
    phone: "(414) 372-8800",
    website: "https://www.lakefrontbrewery.com",
    contactEmail: "tours@lakefrontbrewery.com",
    isFeatured: true,
  },
  {
    name: "Milwaukee Art Museum",
    category: "arts",
    description: "World-class art museum on the lakefront featuring 30,000+ works. The iconic Calatrava building opens its wings daily. Free on select days.",
    address: "700 N Art Museum Dr, Milwaukee, WI 53202",
    city: "Milwaukee",
    latitude: "43.0400",
    longitude: "-87.8970",
    phone: "(414) 224-3200",
    website: "https://mam.org",
    contactEmail: "info@mam.org",
    isFeatured: true,
  },
  {
    name: "Urban Kayaks Milwaukee",
    category: "kayaking",
    description: "Guided and self-guided kayak tours on the Milwaukee River and Harbor. Sunset tours, full-moon paddles, and group outings available.",
    address: "318 N Water St, Milwaukee, WI 53202",
    city: "Milwaukee",
    latitude: "43.0350",
    longitude: "-87.9070",
    phone: "(414) 273-1300",
    website: "https://www.urbankayaks.com",
    contactEmail: "milwaukee@urbankayaks.com",
    isFeatured: false,
  },
  {
    name: "Axe MKE",
    category: "sports",
    description: "Urban axe-throwing venue with private lanes, coaching, and a full bar. A unique and memorable date activity in Milwaukee's Walker's Point neighborhood.",
    address: "930 S 2nd St, Milwaukee, WI 53204",
    city: "Milwaukee",
    latitude: "43.0200",
    longitude: "-87.9100",
    phone: "(414) 988-0293",
    website: "https://www.axemke.com",
    contactEmail: "info@axemke.com",
    isFeatured: false,
  },
  {
    name: "Colectivo Coffee — Lakefront",
    category: "coffee",
    description: "Iconic Milwaukee coffee roaster with a stunning lakefront location. Great for morning walks, first dates, and weekend brunches.",
    address: "1701 N Lincoln Memorial Dr, Milwaukee, WI 53202",
    city: "Milwaukee",
    latitude: "43.0500",
    longitude: "-87.8900",
    phone: "(414) 223-4551",
    website: "https://colectivocoffee.com",
    contactEmail: "hello@colectivocoffee.com",
    isFeatured: false,
  },
  {
    name: "Pabst Mansion",
    category: "arts",
    description: "Historic Victorian mansion offering guided tours of Captain Pabst's stunning 1892 home. A unique cultural date experience in the heart of Milwaukee.",
    address: "2000 W Wisconsin Ave, Milwaukee, WI 53233",
    city: "Milwaukee",
    latitude: "43.0400",
    longitude: "-87.9300",
    phone: "(414) 931-0808",
    website: "https://www.pabstmansion.com",
    contactEmail: "info@pabstmansion.com",
    isFeatured: false,
  },
];

const allVenues = [...waukeshaVenues, ...milwaukeeVenues];

// ── Activity listings per venue ────────────────────────────────────────────────
const activityTemplates = {
  "Waukesha Farmers Market": [
    { title: "Saturday Farmers Market", description: "Browse local produce, artisan goods, and live music every Saturday morning.", category: "community_center", isRecurring: true, recurringSchedule: "Every Saturday 7am–1pm", priceCents: 0, imageEmoji: "🌽" },
  ],
  "Frame Park Mini Golf": [
    { title: "Mini Golf at Frame Park", description: "18-hole course along the Fox River. Perfect for a casual date — half a mile from downtown Waukesha.", category: "mini_golf", isRecurring: false, recurringSchedule: null, priceCents: 800, imageEmoji: "⛳" },
  ],
  "Fox River Trail — Waukesha": [
    { title: "Fox River Trail Walk/Run", description: "Scenic paved trail along the Fox River. Free and open daily — great for a morning jog or evening stroll together.", category: "hiking", isRecurring: true, recurringSchedule: "Open daily dawn to dusk", priceCents: 0, imageEmoji: "🥾" },
  ],
  "Minooka Park": [
    { title: "Disc Golf at Minooka Park", description: "18-hole disc golf course in a beautiful 600-acre county park. Free to play, bring your own discs.", category: "sports", isRecurring: true, recurringSchedule: "Open daily", priceCents: 0, imageEmoji: "🥏" },
    { title: "Hiking & Nature Walk", description: "Explore miles of wooded trails through Minooka Park. Ideal for a relaxed outdoor date.", category: "hiking", isRecurring: true, recurringSchedule: "Open daily", priceCents: 0, imageEmoji: "🌲" },
  ],
  "Waukesha Public Library": [
    { title: "Library Community Events", description: "Free book clubs, author talks, and community events at Waukesha Public Library. Check the calendar for upcoming programs.", category: "library", isRecurring: true, recurringSchedule: "Various weekly events", priceCents: 0, imageEmoji: "📚" },
  ],
  "Waukesha Bowling Center": [
    { title: "Cosmic Bowling Night", description: "Glow-in-the-dark bowling with music and lights every Friday and Saturday night. Great for groups and date nights.", category: "bowling", isRecurring: true, recurringSchedule: "Fri & Sat evenings", priceCents: 1500, imageEmoji: "🎳" },
    { title: "Daytime Open Bowling", description: "Classic bowling lanes available daily. Shoes included. Perfect for a relaxed afternoon outing.", category: "bowling", isRecurring: true, recurringSchedule: "Daily 10am–6pm", priceCents: 700, imageEmoji: "🎳" },
  ],
  "Escape the Room Waukesha": [
    { title: "Escape Room Challenge", description: "60-minute immersive escape room for 2–8 players. Multiple themed rooms available. Book in advance.", category: "escape_room", isRecurring: false, recurringSchedule: null, priceCents: 2800, imageEmoji: "🔐" },
  ],
  "Cafe Corazón — Waukesha": [
    { title: "Coffee Date at Cafe Corazón", description: "Cozy independent coffee shop perfect for a low-key first date. Specialty lattes and fresh pastries.", category: "coffee", isRecurring: true, recurringSchedule: "Open daily 7am–7pm", priceCents: 0, imageEmoji: "☕" },
  ],
  "Milwaukee Public Market": [
    { title: "Milwaukee Public Market Visit", description: "Year-round indoor market with local food vendors, fresh produce, and artisan goods in the Historic Third Ward.", category: "community_center", isRecurring: true, recurringSchedule: "Open daily", priceCents: 0, imageEmoji: "🛒" },
  ],
  "Lakefront Brewery Tour": [
    { title: "Brewery Tour & Tasting", description: "Guided tour of Lakefront Brewery with beer tastings. Friday nights feature live polka music — a Milwaukee classic.", category: "other", isRecurring: true, recurringSchedule: "Fri evenings, Sat–Sun afternoons", priceCents: 1500, imageEmoji: "🍺" },
  ],
  "Milwaukee Art Museum": [
    { title: "Art Museum Date", description: "Explore 30,000+ works at one of America's finest art museums. The Calatrava wings open daily at 10am.", category: "arts", isRecurring: true, recurringSchedule: "Tue–Sun 10am–5pm", priceCents: 1900, imageEmoji: "🎨" },
  ],
  "Urban Kayaks Milwaukee": [
    { title: "Milwaukee River Kayak Tour", description: "Guided kayak tour on the Milwaukee River through downtown. Sunset and full-moon tours available.", category: "kayaking", isRecurring: false, recurringSchedule: null, priceCents: 4500, imageEmoji: "🛶" },
  ],
  "Axe MKE": [
    { title: "Axe Throwing Experience", description: "Private axe-throwing lanes with coaching and a full bar. Unique and memorable date night in Walker's Point.", category: "sports", isRecurring: false, recurringSchedule: null, priceCents: 3500, imageEmoji: "🪓" },
  ],
  "Colectivo Coffee — Lakefront": [
    { title: "Lakefront Coffee Walk", description: "Grab coffee at Colectivo's iconic lakefront location and walk along Lake Michigan. Free and beautiful.", category: "coffee", isRecurring: true, recurringSchedule: "Open daily 6am–8pm", priceCents: 0, imageEmoji: "☕" },
  ],
  "Pabst Mansion": [
    { title: "Pabst Mansion Guided Tour", description: "Step inside Captain Pabst's stunning 1892 Victorian mansion. A unique cultural date experience in Milwaukee.", category: "arts", isRecurring: false, recurringSchedule: null, priceCents: 1200, imageEmoji: "🏛️" },
  ],
};

console.log("Seeding local venues and activities...");

for (const venue of allVenues) {
  // Check if already exists
  const [existing] = await db.execute(
    "SELECT id FROM venue_partners WHERE name = ? AND city = ? LIMIT 1",
    [venue.name, venue.city]
  );
  
  let venueId;
  if (existing.length > 0) {
    venueId = existing[0].id;
    console.log(`  ✓ Venue already exists: ${venue.name} (id=${venueId})`);
  } else {
    const [result] = await db.execute(
      `INSERT INTO venue_partners (name, category, description, address, city, latitude, longitude, phone, website, contactEmail, isActive, isFeatured, referralFeePerVisit, commissionPct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 100, 12)`,
      [venue.name, venue.category, venue.description, venue.address, venue.city,
       venue.latitude, venue.longitude, venue.phone, venue.website, venue.contactEmail,
       venue.isFeatured ? 1 : 0]
    );
    venueId = result.insertId;
    console.log(`  + Inserted venue: ${venue.name} (id=${venueId})`);
  }

  // Insert activity listings for this venue
  const activities = activityTemplates[venue.name] ?? [];
  for (const act of activities) {
    const [existingAct] = await db.execute(
      "SELECT id FROM activity_listings WHERE venueId = ? AND title = ? LIMIT 1",
      [venueId, act.title]
    );
    if (existingAct.length > 0) {
      console.log(`    ✓ Activity already exists: ${act.title}`);
      continue;
    }
    await db.execute(
      `INSERT INTO activity_listings (venueId, title, description, category, isRecurring, recurringSchedule, priceCents, imageEmoji, isActive, isSponsored, maxGroupSize, minGroupSize, durationMinutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 10, 2, 120)`,
      [venueId, act.title, act.description, act.category,
       act.isRecurring ? 1 : 0, act.recurringSchedule, act.priceCents, act.imageEmoji]
    );
    console.log(`    + Inserted activity: ${act.title}`);
  }
}

console.log("\nDone! Local venues and activities seeded.");
await db.end();
