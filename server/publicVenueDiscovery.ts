import { and, desc, eq, sql } from "drizzle-orm";
import { activityListings, cityActivityRefreshes, venuePartners } from "../drizzle/schema";
import { getDb } from "./db";
import { makeRequest, type GeocodingResult, type PlacesSearchResult } from "./_core/map";

export const PUBLIC_ACTIVITY_CATEGORIES = [
  "swimming_pool",
  "beach",
  "basketball",
  "dirt_track",
  "ymca",
  "public_gym",
  "golf",
  "disc_golf",
  "volleyball",
  "tennis",
  "church",
  "arts",
] as const;

type PublicActivityCategory = (typeof PUBLIC_ACTIVITY_CATEGORIES)[number];

type PublicVenueSeed = {
  venueName: string;
  category: PublicActivityCategory;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  website: string;
  emoji: string;
  accessNotes: string;
  latitude?: string;
  longitude?: string;
};

type DiscoverySearch = {
  category: PublicActivityCategory;
  query: string;
  titlePrefix: string;
  description: string;
  emoji: string;
};

const DISCOVERY_SEARCHES: DiscoverySearch[] = [
  { category: "swimming_pool", query: "public swimming pool", titlePrefix: "Open swim at", description: "A local place to swim, take an aqua-fitness class, or plan a casual pool day together.", emoji: "🏊" },
  { category: "beach", query: "public beach", titlePrefix: "Beach day at", description: "A nearby public waterfront option for a relaxed beach, walking, or sunset outing.", emoji: "🏖️" },
  { category: "basketball", query: "public basketball court", titlePrefix: "Pickup basketball at", description: "A local court for a casual game, shooting practice, or meeting active people.", emoji: "🏀" },
  { category: "golf", query: "public golf course", titlePrefix: "Tee time at", description: "A public golf option for a round, practice session, or beginner-friendly outing.", emoji: "⛳" },
  { category: "disc_golf", query: "public disc golf course", titlePrefix: "Disc golf at", description: "A public disc-golf option for a low-pressure outdoor activity with new people.", emoji: "🥏" },
  { category: "tennis", query: "public tennis court", titlePrefix: "Tennis at", description: "A local court for a friendly rally, lesson, or informal match.", emoji: "🎾" },
  { category: "volleyball", query: "public volleyball court", titlePrefix: "Volleyball at", description: "A local indoor or outdoor court for casual play, leagues, or open gym.", emoji: "🏐" },
  { category: "ymca", query: "YMCA", titlePrefix: "Community fitness at", description: "A YMCA location with fitness, sports, aquatics, or community programs to explore.", emoji: "🤝" },
  { category: "public_gym", query: "public recreation center gym", titlePrefix: "Open gym at", description: "A community recreation option for fitness, court sports, and meeting locally active people.", emoji: "🏋️" },
  { category: "dirt_track", query: "public motocross dirt track", titlePrefix: "Ride day at", description: "A regional off-road or dirt-track option for riders; confirm vehicle, pass, and safety requirements first.", emoji: "🏍️" },
  { category: "church", query: "church community events", titlePrefix: "Community gathering at", description: "A local faith-community option for public gatherings, service opportunities, classes, meals, music, or social events.", emoji: "⛪" },
  { category: "arts", query: "community theater auditions", titlePrefix: "Theater community at", description: "A local performing-arts option for plays, musicals, auditions, volunteer work, classes, or simply attending a show.", emoji: "🎭" },
];

const MILWAUKEE_CURATED_SEEDS: PublicVenueSeed[] = [
  {
    venueName: "Wilson Pool",
    category: "swimming_pool",
    title: "Open swim at Wilson Pool",
    description: "Meet for open swim, lap swim, or night swim at Milwaukee County Parks' heated 50-meter pool.",
    address: "4001 S. 20th St.",
    city: "Milwaukee",
    state: "WI",
    website: "https://county.milwaukee.gov/EN/Parks/Explore/Pools/Outdoor",
    emoji: "🏊",
    accessNotes: "Public seasonal pool; open swim, lap swim, and night swim times vary. Check the official schedule and admission before you go.",
  },
  {
    venueName: "Bradford Beach",
    category: "beach",
    title: "Beach day at Bradford Beach",
    description: "Plan a public Lake Michigan beach day, walk, swim at your own risk, or join seasonal beach volleyball nearby.",
    address: "2400 N. Lincoln Memorial Drive",
    city: "Milwaukee",
    state: "WI",
    website: "https://county.milwaukee.gov/EN/Parks/Explore/Lakefront/Beaches",
    emoji: "🏖️",
    accessNotes: "Public beach access from 6 a.m. to 9 p.m.; swimming is at your own risk. Confirm current beach advisories before visiting.",
  },
  {
    venueName: "Bradford Beach",
    category: "volleyball",
    title: "Beach volleyball at Bradford Beach",
    description: "Use Bradford Beach as a natural meet-up point for seasonal sand volleyball and a lakefront social outing.",
    address: "2400 N. Lincoln Memorial Drive",
    city: "Milwaukee",
    state: "WI",
    website: "https://county.milwaukee.gov/EN/Parks/Experience/Get-Active",
    emoji: "🏐",
    accessNotes: "Seasonal beach volleyball is available through local organizers. Confirm court availability, league times, or rentals before attending.",
  },
  {
    venueName: "Dr. Martin Luther King Jr. Community Center",
    category: "basketball",
    title: "Open gym basketball at King Center",
    description: "A community option for open-gym basketball, fitness rooms, and recreational programming.",
    address: "1531 W. Vliet St.",
    city: "Milwaukee",
    state: "WI",
    website: "https://mkecoparks.helpscoutdocs.com/article/359-where-can-i-play-basketball",
    emoji: "🏀",
    accessNotes: "Community-center access and open-gym times can vary; confirm membership, age, and daily availability before visiting.",
  },
  {
    venueName: "Milwaukee County Sports Complex",
    category: "volleyball",
    title: "Court sports at Milwaukee County Sports Complex",
    description: "A multi-sport option for volleyball, basketball, pickleball, soccer, and organized indoor recreation.",
    address: "6000 W. Ryan Rd.",
    city: "Franklin",
    state: "WI",
    website: "https://county.milwaukee.gov/EN/Parks/Experience/Get-Active",
    emoji: "🏐",
    accessNotes: "Open gym and court availability may require a reservation or vary by schedule. Check the complex before making plans.",
  },
  {
    venueName: "Rite-Hite Family YMCA",
    category: "ymca",
    title: "Community fitness at Rite-Hite Family YMCA",
    description: "A YMCA option with fitness equipment, group exercise, an indoor walking track, and community programming.",
    address: "9250 N. Green Bay Rd.",
    city: "Brown Deer",
    state: "WI",
    website: "https://www.ymcamke.org/locations/rite-hite-family-ymca/",
    emoji: "🤝",
    accessNotes: "Membership, guest access, and program eligibility may apply. Confirm current hours and facility access directly with the YMCA.",
  },
  {
    venueName: "Dretzka Park Golf Course",
    category: "golf",
    title: "Tee time at Dretzka Park Golf Course",
    description: "A Milwaukee County Parks public golf course suitable for a round, practice, or small-group outing.",
    address: "12020 W. Bradley Rd.",
    city: "Milwaukee",
    state: "WI",
    website: "https://mke.golf/",
    emoji: "⛳",
    accessNotes: "Public pay-to-play course. Check course conditions, tee times, green fees, and cart availability before you go.",
  },
  {
    venueName: "Dretzka Disc Golf Course",
    category: "disc_golf",
    title: "Disc golf at Dretzka Park",
    description: "Play Milwaukee County Parks' public 27-hole disc-golf layout with a mix of wooded and open shots.",
    address: "12020 W. Bradley Rd.",
    city: "Milwaukee",
    state: "WI",
    website: "https://county.milwaukee.gov/EN/Parks/Experience/Sports/Disc-Golf",
    emoji: "🥏",
    accessNotes: "A day permit or annual pass is required for full courses. Confirm conditions and any tournament closures before playing.",
  },
  {
    venueName: "Milwaukee County Parks Tennis Courts",
    category: "tennis",
    title: "Tennis at Milwaukee County Parks",
    description: "Find a public tennis court for a friendly rally, lesson, or casual match in one of Milwaukee County's parks.",
    address: "Milwaukee County Parks",
    city: "Milwaukee",
    state: "WI",
    website: "https://county.milwaukee.gov/EN/Parks/Plan/Rent-an-Athletic-Field",
    emoji: "🎾",
    accessNotes: "Unreserved courts may be used first-come, first-served; reservations are available for a fee. Confirm the specific court before visiting.",
  },
  {
    venueName: "Dyracuse Recreational Park",
    category: "dirt_track",
    title: "Ride day at Dyracuse Recreational Park",
    description: "A regional public day-pass destination with motocross, supercross, ATV/UTV, beginner tracks, and off-road trails.",
    address: "1047 County Road O",
    city: "Nekoosa",
    state: "WI",
    website: "https://romewi.gov/dyracuse/",
    emoji: "🏍️",
    accessNotes: "Public day-pass park with seasonal hours. Confirm open-riding dates, waiver rules, vehicle requirements, and pricing before the trip.",
  },
  {
    venueName: "Sunset Playhouse",
    category: "arts",
    title: "Attend, audition, or volunteer at Sunset Playhouse",
    description: "A local community-theater option for live plays and musicals, with public auditions and volunteer pathways.",
    address: "800 Elm Grove Rd.",
    city: "Elm Grove",
    state: "WI",
    website: "https://sunsetplayhouse.com/",
    emoji: "🎭",
    accessNotes: "Community theater: check the official site for current productions, ticket information, auditions, and volunteer opportunities. Auditions are open to the public when scheduled.",
  },
  {
    venueName: "Waukesha Civic Theatre",
    category: "arts",
    title: "Get involved with Waukesha Civic Theatre",
    description: "Discover local productions, youth opportunities, classes, auditions, and volunteer paths at a long-running community theater.",
    address: "264 W. Main St.",
    city: "Waukesha",
    state: "WI",
    website: "https://www.waukeshacivictheatre.org/get-involved/auditions/",
    emoji: "🎭",
    accessNotes: "Check the official auditions page for age requirements, dates, production details, classes, volunteer opportunities, and ticket information.",
  },
  {
    venueName: "UW–Milwaukee Peck School of the Arts",
    category: "arts",
    title: "See a campus play or musical at UWM",
    description: "Follow UWM’s public theater calendar for student productions, staged readings, musicals, and performing-arts events.",
    address: "2400 E. Kenwood Blvd.",
    city: "Milwaukee",
    state: "WI",
    website: "https://uwm.edu/arts/events-community/theatre-performances/",
    emoji: "🎟️",
    accessNotes: "Public performances vary by production. Use the official calendar for show dates, tickets, venue details, and arts contact information.",
  },
  {
    venueName: "Marquette Theatre Arts",
    category: "arts",
    title: "See a student production at Marquette",
    description: "Follow Marquette Theatre Arts for student-led plays, musicals, campus performances, and ways to participate on stage or behind the scenes.",
    address: "1250 W. Wisconsin Ave.",
    city: "Milwaukee",
    state: "WI",
    website: "https://www.marquette.edu/arts/theatre-arts.php",
    emoji: "🎓",
    accessNotes: "Use the official Marquette Arts links for upcoming performances, tickets, and student participation information. Access varies by production.",
  },
  {
    venueName: "Carroll University Theatre",
    category: "arts",
    title: "Follow theater and musical productions at Carroll University",
    description: "A Waukesha campus source for fully produced stage work, including musicals, comedies, and student opportunities in theater.",
    address: "100 N. East Ave.",
    city: "Waukesha",
    state: "WI",
    website: "https://carrollu.edu/academics/arts-sciences/theatre/",
    emoji: "🎭",
    accessNotes: "Check Carroll’s official theater pages for production announcements, public attendance details, student participation, and department contacts.",
  },
  {
    venueName: "Milwaukee Youth Theatre",
    category: "arts",
    title: "Join a youth or high-school theater production",
    description: "A youth-theater option for classes, productions, and audition opportunities for young people through high school.",
    address: "Milwaukee, WI",
    city: "Milwaukee",
    state: "WI",
    website: "https://milwaukeeyouththeatre.org/",
    emoji: "🎬",
    accessNotes: "Youth and high-school participation rules vary by production. Check current audition notices, program ages, and class registration on the official site.",
  },
  {
    venueName: "Milwaukee High School of the Arts",
    category: "arts",
    title: "Support student theater at Milwaukee High School of the Arts",
    description: "Track student theater productions, including the fall show and spring musical, and learn how student performers can audition.",
    address: "Milwaukee, WI",
    city: "Milwaukee",
    state: "WI",
    website: "https://mps.school/mhsa/academics/theatre-film/",
    emoji: "🎓",
    accessNotes: "Student participation is school-based; public performance and ticket information should be confirmed with the school. The program publishes student audition opportunities.",
  },
];

const WAUKESHA_CURATED_SEEDS: PublicVenueSeed[] = [
  {
    venueName: "Buchner Park Community Pool",
    category: "swimming_pool",
    title: "Open swim at Buchner Park Community Pool",
    description: "Meet for open swim, lap swim, aqua fitness, or a relaxed pool day at Waukesha’s public seasonal pool.",
    address: "223 Oakland Avenue",
    city: "Waukesha",
    state: "WI",
    website: "https://www.waukesha-wi.gov/government/departments/pools.php",
    emoji: "🏊",
    accessNotes: "Public seasonal pool with daily admission; open-swim hours and member-only lap/current-channel windows vary. Check the official schedule before visiting.",
    latitude: "43.0197",
    longitude: "-88.2364",
  },
  {
    venueName: "Horeb Springs Aquatic Center",
    category: "swimming_pool",
    title: "Swim and slide at Horeb Springs Aquatic Center",
    description: "Plan a public swim, family outing, lesson, or water-based meet-up at Waukesha’s Horeb Springs facility.",
    address: "330 Spring Street",
    city: "Waukesha",
    state: "WI",
    website: "https://www.waukesha-wi.gov/government/departments/pools.php",
    emoji: "🌊",
    accessNotes: "Public seasonal aquatic center with daily admission; slides, diving boards, family swim, and lesson times vary by schedule and fee. Confirm hours before going.",
    latitude: "43.0150",
    longitude: "-88.2287",
  },
  {
    venueName: "Minooka Park Beach",
    category: "beach",
    title: "Beach day at Minooka Park",
    description: "Meet for a public lake beach, walking, swimming in the designated area, or a relaxed outdoor day near Waukesha.",
    address: "1927 E Sunset Dr",
    city: "Waukesha",
    state: "WI",
    website: "https://www.waukeshacounty.gov/parks-and-land-use/parks-and-recreation/parks-and-trails/beaches/",
    emoji: "🏖️",
    accessNotes: "Seasonal county beach; swimming is at your own risk with no lifeguards. A county daily vehicle permit or annual membership is required, and water-quality advisories can change.",
    latitude: "42.9744",
    longitude: "-88.2547",
  },
  {
    venueName: "Waukesha YMCA",
    category: "ymca",
    title: "Community fitness at Waukesha YMCA",
    description: "Explore fitness, swim, group exercise, sports, aquatics, and community programs at the Waukesha YMCA.",
    address: "320 E. Broadway",
    city: "Waukesha",
    state: "WI",
    website: "https://www.gwcymca.org/locations/waukesha-ymca/",
    emoji: "🤝",
    accessNotes: "Membership, guest access, class registration, and program eligibility vary. Confirm current hours and access rules directly with the YMCA.",
    latitude: "43.0078",
    longitude: "-88.2278",
  },
  {
    venueName: "Waukesha County Beaches",
    category: "volleyball",
    title: "Outdoor recreation at Waukesha County beaches",
    description: "Use the county’s beach system for swimming, volleyball, shoreline walks, kayaking, and low-pressure outdoor meet-ups near Waukesha.",
    address: "Waukesha County Parks",
    city: "Waukesha",
    state: "WI",
    website: "https://www.waukeshacounty.gov/parks-and-land-use/parks-and-recreation/parks-and-trails/beaches/",
    emoji: "🏐",
    accessNotes: "County beaches and amenities vary by park and season. Check current beach status, water quality, permits, hours, and volleyball availability before making plans.",
    latitude: "42.9744",
    longitude: "-88.2547",
  },
];

const MADISON_CURATED_SEEDS: PublicVenueSeed[] = [
  {
    venueName: "Irwin A. and Robert D. Goodman Pool",
    category: "swimming_pool",
    title: "Open swim at Goodman Pool",
    description: "Plan an open swim, lap swim, class, or casual pool day at Madison's municipal Goodman Pool.",
    address: "325 W. Olin Avenue",
    city: "Madison",
    state: "WI",
    website: "https://www.cityofmadison.com/parks/pool",
    emoji: "🏊",
    accessNotes: "City-operated seasonal pool. Admission, hours, the visitor waiver, and program availability can change; confirm the official pool checklist before you go.",
  },
  {
    venueName: "Warner Park Community Recreation Center",
    category: "public_gym",
    title: "Community recreation at Warner Park",
    description: "Explore public gymnasiums, fitness, pickleball, programs, and community activities at Madison's Warner Park Community Recreation Center.",
    address: "1625 Northport Drive",
    city: "Madison",
    state: "WI",
    website: "https://www.cityofmadison.com/parks/wpcrc",
    emoji: "🏋️",
    accessNotes: "City-operated recreation center. Hours, program eligibility, facility access, reservations, and pickleball or gym availability vary; confirm details directly with the center.",
  },
];

export function normalizeDiscoveryCity(city: string): string {
  return city.trim().replace(/,\s*[A-Z]{2}$/i, "");
}

export function getCuratedPublicSeedsForCity(city: string): PublicVenueSeed[] {
  const normalizedCity = normalizeDiscoveryCity(city).toLowerCase();
  if (normalizedCity === "milwaukee") return MILWAUKEE_CURATED_SEEDS;
  if (normalizedCity === "waukesha") return WAUKESHA_CURATED_SEEDS;
  if (normalizedCity === "madison") return MADISON_CURATED_SEEDS;
  return [];
}

export function buildPublicVenueSearchPlan(city: string, state?: string) {
  const location = [normalizeDiscoveryCity(city), state?.trim()].filter(Boolean).join(", ");
  return DISCOVERY_SEARCHES.map((search) => ({
    ...search,
    query: `${search.query} in ${location}`,
  }));
}

async function findOrCreateVenue(seed: PublicVenueSeed): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const existing = await db
    .select({ id: venuePartners.id })
    .from(venuePartners)
    .where(and(eq(venuePartners.name, seed.venueName), eq(venuePartners.city, seed.city)))
    .limit(1);

  if (existing[0]) return existing[0].id;

  await db.insert(venuePartners).values({
    name: seed.venueName,
    category: seed.category,
    description: seed.description,
    address: seed.address,
    city: seed.city,
    website: seed.website,
    latitude: seed.latitude,
    longitude: seed.longitude,
    isPublicAccess: true,
    accessNotes: seed.accessNotes,
    referralFeePerVisit: 0,
    isActive: true,
  });

  const created = await db
    .select({ id: venuePartners.id })
    .from(venuePartners)
    .where(and(eq(venuePartners.name, seed.venueName), eq(venuePartners.city, seed.city)))
    .limit(1);

  return created[0]?.id ?? null;
}

async function upsertPublicActivity(seed: PublicVenueSeed): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const venueId = await findOrCreateVenue(seed);
  if (!venueId) return false;

  const existing = await db
    .select({ id: activityListings.id })
    .from(activityListings)
    .where(and(eq(activityListings.venueId, venueId), eq(activityListings.category, seed.category)))
    .limit(1);

  if (existing[0]) return false;

  await db.insert(activityListings).values({
    venueId,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    maxGroupSize: 8,
    isRecurring: true,
    recurringSchedule: "Check current venue schedule",
    priceCents: 0,
    hasTickets: false,
    imageEmoji: seed.emoji,
    isPublicAccess: true,
    accessNotes: seed.accessNotes,
    isActive: true,
  });
  return true;
}

async function countPublicActivitiesForCity(city: string): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const row = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityListings)
    .innerJoin(venuePartners, eq(activityListings.venueId, venuePartners.id))
    .where(and(eq(venuePartners.city, city), eq(activityListings.isPublicAccess, true)));
  return Number(row[0]?.count ?? 0);
}

async function wasRecentlyRefreshed(city: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const latest = await db
    .select({ lastRefreshedAt: cityActivityRefreshes.lastRefreshedAt })
    .from(cityActivityRefreshes)
    .where(eq(cityActivityRefreshes.city, city))
    .orderBy(desc(cityActivityRefreshes.lastRefreshedAt))
    .limit(1);
  const lastRefresh = latest[0]?.lastRefreshedAt?.getTime() ?? 0;
  return Date.now() - lastRefresh < 6 * 60 * 60 * 1000;
}

async function recordRefresh(city: string, state?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(cityActivityRefreshes).values({
    city,
    state: state ?? null,
    lastRefreshedAt: new Date(),
  });
}

async function geocodeCity(city: string, state?: string) {
  const query = [city, state?.trim(), "USA"].filter(Boolean).join(", ");
  const result = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: query });
  return result.results[0]?.geometry.location ?? null;
}

async function discoverPublicActivitiesFromMaps(city: string, state?: string): Promise<number> {
  const coords = await geocodeCity(city, state);
  if (!coords) return 0;

  const discovered = await Promise.all(
    buildPublicVenueSearchPlan(city, state).map(async (search) => {
      try {
        const result = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", {
          query: search.query,
          location: `${coords.lat},${coords.lng}`,
          radius: 40000,
        });
        const place = result.results[0];
        if (!place?.place_id || !place.name) return false;

        return upsertPublicActivity({
          venueName: place.name,
          category: search.category,
          title: `${search.titlePrefix} ${place.name}`,
          description: search.description,
          address: place.formatted_address ?? city,
          city,
          state: state ?? "",
          website: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          emoji: search.emoji,
          accessNotes: "Public-access search result. Confirm current hours, reservations, guest rules, and fees directly with the venue before making plans.",
        });
      } catch (error) {
        console.warn(`[publicVenueDiscovery] Could not discover ${search.category} for ${city}:`, error);
        return false;
      }
    }),
  );

  return discovered.filter(Boolean).length;
}

/**
 * Starts a city-specific activity refresh. It is safe to call after login or a GPS-city change:
 * venue/title checks make it idempotent, and map discovery only runs for thin city feeds.
 */
export async function refreshPublicActivitiesForCity(city: string, state?: string): Promise<void> {
  const normalizedCity = normalizeDiscoveryCity(city);
  if (normalizedCity.length < 2) return;

  const curatedSeeds = getCuratedPublicSeedsForCity(normalizedCity);
  if (curatedSeeds.length > 0) {
    await Promise.all(curatedSeeds.map(upsertPublicActivity));
  }

  if (await wasRecentlyRefreshed(normalizedCity)) return;

  const count = await countPublicActivitiesForCity(normalizedCity);
  if (count >= 8) {
    await recordRefresh(normalizedCity, state);
    return;
  }

  await discoverPublicActivitiesFromMaps(normalizedCity, state);
  await recordRefresh(normalizedCity, state);
}
