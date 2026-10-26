import { makeRequest, type PlacesSearchResult } from "./_core/map";
import { resolveLocationQuery } from "./locationResolver";

export type CommunityDirectoryKind = "churches" | "help";

type DirectorySearchInput = {
  city: string;
  state?: string | null;
  kind: CommunityDirectoryKind;
  lat?: number;
  lng?: number;
};

type DirectoryMapSource = "OpenStreetMap" | "Google Maps";

type DirectoryMapResult = {
  directoryId: string;
  source: DirectoryMapSource;
  name: string;
  address: string;
  mapUrl: string;
  directionsUrl?: string;
  religion?: string;
  denomination?: string;
};

type VerifiedCommunityResource = {
  name: string;
  address: string;
  summary: string;
  officialWebsite: string;
  accessUrl: string;
  officialEventsUrl?: string;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type CongregationInventory = {
  results: DirectoryMapResult[];
  coverageAvailable: boolean;
  coverageNote: string;
};

const COMMUNITY_RADIUS_METERS = 16_000;
const COMMUNITY_RADIUS_MILES = Math.round(COMMUNITY_RADIUS_METERS / 1609.344);
const CONGREGATION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const congregationCache = new Map<string, { expiresAt: number; inventory: CongregationInventory }>();
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

const WAUKESHA_VERIFIED_HELP: VerifiedCommunityResource[] = [
  {
    name: "James Place Waukesha",
    address: "129 W. Broadway, Waukesha, WI 53186",
    summary: "Community resources and behavioral-health services, including support for basic needs, job and computer assistance, and community connection.",
    officialWebsite: "https://jamesplacewi.org/",
    accessUrl: "https://jamesplacewi.org/waukesha/",
    officialEventsUrl: "https://jamesplacewi.org/events/",
  },
  {
    name: "The Salvation Army – Waukesha Corps Community Center",
    address: "445 Madison Street, Waukesha, WI 53188",
    summary: "Publicly listed community support includes meals, family services, food pantry support, Pathway of Hope, and a men's emergency shelter.",
    officialWebsite: "https://www.salvationarmyusa.org/wi/waukesha/",
    accessUrl: "https://www.salvationarmyusa.org/wi/waukesha/madison-street-corps/contact-us/",
  },
  {
    name: "Hope Center WI",
    address: "101 W. Broadway, Waukesha, WI 53186",
    summary: "Basic-needs services include clothing, community meals, day-center access, garden, financial or vital-document assistance, and shower/laundry access.",
    officialWebsite: "https://hopecenterwi.org/",
    accessUrl: "https://hopecenterwi.org/programs/",
    officialEventsUrl: "https://hopecenterwi.org/events/",
  },
];

function normalizeCity(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

function displayTag(value: string | undefined) {
  return value?.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || undefined;
}

function placeToDirectoryResult(place: PlacesSearchResult["results"][number]): DirectoryMapResult | null {
  if (!place.place_id || !place.name) return null;
  const location = place.geometry?.location;
  return {
    directoryId: `google:${place.place_id}`,
    source: "Google Maps",
    name: place.name,
    address: place.formatted_address ?? "Address available in Google Maps",
    mapUrl: `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.place_id)}`,
    directionsUrl: location ? `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}` : undefined,
  };
}

function osmAddress(tags: Record<string, string | undefined>) {
  const explicit = displayTag(tags["addr:full"]);
  if (explicit) return explicit;
  const street = [displayTag(tags["addr:housenumber"]), displayTag(tags["addr:street"])].filter(Boolean).join(" ");
  const locality = [displayTag(tags["addr:city"]), displayTag(tags["addr:state"]), displayTag(tags["addr:postcode"])].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(", ") || "Address available in the public map record";
}

function overpassElementToDirectoryResult(element: OverpassElement): DirectoryMapResult | null {
  const tags = element.tags ?? {};
  const name = displayTag(tags.name);
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    directoryId: `osm:${element.type}:${element.id}`,
    source: "OpenStreetMap",
    name,
    address: osmAddress(tags),
    mapUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    religion: displayTag(tags.religion),
    denomination: displayTag(tags.denomination),
  };
}

function dedupeDirectoryResults(results: DirectoryMapResult[]) {
  const bySource = new Map<string, DirectoryMapResult>();
  const byNameAndAddress = new Set<string>();
  results.forEach((result) => {
    const titleKey = `${normalizeName(result.name)}|${normalizeName(result.address)}`;
    if (byNameAndAddress.has(titleKey)) return;
    byNameAndAddress.add(titleKey);
    bySource.set(result.directoryId, result);
  });
  return Array.from(bySource.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function verifiedResourcesFor(input: DirectorySearchInput) {
  if (input.kind !== "help") return [];
  return normalizeCity(input.city) === "waukesha" ? WAUKESHA_VERIFIED_HELP : [];
}

function googleSearchQueries(input: DirectorySearchInput) {
  const cityLabel = [input.city.trim(), input.state?.trim()].filter(Boolean).join(", ");
  if (input.kind === "churches") return [`churches in ${cityLabel}`];
  return [
    `community resource centers in ${cityLabel}`,
    `food pantry and social services in ${cityLabel}`,
  ];
}

async function searchGooglePublicMapListings(input: DirectorySearchInput) {
  const requests: Promise<PlacesSearchResult>[] = googleSearchQueries(input).map((query) =>
    makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", {
      query,
      location: Number.isFinite(input.lat) && Number.isFinite(input.lng) ? `${input.lat},${input.lng}` : undefined,
      radius: Number.isFinite(input.lat) && Number.isFinite(input.lng) ? COMMUNITY_RADIUS_METERS : undefined,
    }),
  );
  const settled = await Promise.allSettled(requests);
  return dedupeDirectoryResults(settled.flatMap((result) =>
    result.status === "fulfilled" ? (result.value.results ?? []).map(placeToDirectoryResult).filter((place): place is DirectoryMapResult => Boolean(place)) : [],
  ));
}

function congregationOverpassQuery(lat: number, lng: number) {
  const around = `around:${COMMUNITY_RADIUS_METERS},${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `[out:json][timeout:35];(
    nwr["amenity"="place_of_worship"](${around});
    nwr["building"="church"](${around});
  );out center tags;`;
}

async function fetchOverpassElements(query: string) {
  let lastError: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Just-Putzit-community-directory/1.0 (public congregation lookup)",
        },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`Public map inventory returned ${response.status}.`);
      const payload = await response.json() as OverpassResponse;
      if (!Array.isArray(payload.elements)) throw new Error("Public map inventory returned no element list.");
      return payload.elements;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Public map inventory request failed.");
    }
  }
  throw lastError ?? new Error("Public map inventory is unavailable.");
}

async function directoryCoordinates(input: DirectorySearchInput) {
  if (Number.isFinite(input.lat) && Number.isFinite(input.lng)) return { lat: input.lat as number, lng: input.lng as number };
  const query = [input.city, input.state].filter(Boolean).join(", ");
  const resolved = await resolveLocationQuery(query);
  return resolved ? { lat: resolved.lat, lng: resolved.lng } : null;
}

async function comprehensiveCongregationInventory(input: DirectorySearchInput): Promise<CongregationInventory> {
  const coordinates = await directoryCoordinates(input);
  if (!coordinates) return {
    results: [],
    coverageAvailable: false,
    coverageNote: "The selected community could not be located for the full public map inventory.",
  };
  const cacheKey = `${coordinates.lat.toFixed(3)},${coordinates.lng.toFixed(3)}`;
  const cached = congregationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.inventory;

  try {
    const elements = await fetchOverpassElements(congregationOverpassQuery(coordinates.lat, coordinates.lng));
    const inventory: CongregationInventory = {
      results: dedupeDirectoryResults(elements.map(overpassElementToDirectoryResult).filter((result): result is DirectoryMapResult => Boolean(result))),
      coverageAvailable: true,
      coverageNote: `All public OpenStreetMap congregation records found within about ${COMMUNITY_RADIUS_MILES} miles of the selected community center are included below.`,
    };
    congregationCache.set(cacheKey, { inventory, expiresAt: Date.now() + CONGREGATION_CACHE_TTL_MS });
    return inventory;
  } catch (error) {
    console.warn("[communityDirectory] Full public congregation inventory unavailable:", error instanceof Error ? error.message : error);
    return {
      results: [],
      coverageAvailable: false,
      coverageNote: "The full public congregation map inventory is temporarily unavailable. Supplemental public listings remain available below.",
    };
  }
}

/**
 * The church directory is deliberately not a handpicked source list. It queries every public
 * OpenStreetMap place-of-worship/building record in the selected community area and labels the
 * provider. Official calendars remain a separate future-event pathway and never imply complete
 * directory coverage; Google Maps is used only for the separate community-help lookup.
 */
export async function getCommunityDirectory(input: DirectorySearchInput) {
  const city = input.city.trim();
  if (!city) throw new Error("A city is required for community directory search.");

  if (input.kind === "churches") {
    const congregationInventory = await comprehensiveCongregationInventory({ ...input, city });
    return {
      city,
      kind: input.kind,
      verifiedResources: [],
      mapResults: congregationInventory.results,
      supplementalMapResults: [] as DirectoryMapResult[],
      congregationCoverage: {
        available: congregationInventory.coverageAvailable,
        note: congregationInventory.coverageNote,
        radiusMiles: COMMUNITY_RADIUS_MILES,
      },
    };
  }

  const mapResults = await searchGooglePublicMapListings({ ...input, city });
  return {
    city,
    kind: input.kind,
    verifiedResources: verifiedResourcesFor({ ...input, city }),
    mapResults,
    supplementalMapResults: [] as DirectoryMapResult[],
    congregationCoverage: null,
  };
}

export function isCommunityDirectoryCity(value: string | null | undefined) {
  const city = value?.trim() ?? "";
  return city.length >= 2 && city.length <= 100;
}
