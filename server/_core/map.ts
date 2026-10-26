/**
 * Map services (server side), backed by MapTiler.
 *
 * makeRequest<T>(endpoint, params) keeps the call shape the rest of the server already uses, and returns
 * Google-shaped results so the callers did not have to change:
 *   "/maps/api/geocode/json"           -> MapTiler forward geocoding   -> GeocodingResult
 *   "/maps/api/place/textsearch/json"  -> MapTiler POI search          -> PlacesSearchResult
 * Authenticated with MAPTILER_API_KEY. The key is never logged or included in error messages.
 *
 * Differences from Google Places to be aware of: no ratings, no business status, and place ids are MapTiler
 * ids ("poi.123"), not Google place ids. Free-text phrases such as "churches in Waukesha, WI" are reduced to
 * keywords because MapTiler matches names and categories, not sentences.
 */

import { ENV } from "./env";

const MAPTILER_GEOCODING_URL = "https://api.maptiler.com/geocoding";
const REQUEST_TIMEOUT_MS = 15_000;
const POI_LIMIT = 10;
const MAX_PLACE_RESULTS = 20;
const METERS_PER_DEGREE = 111_320;

export type LatLng = { lat: number; lng: number };

export type GeocodingResult = {
  results: Array<{
    address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
    formatted_address: string;
    geometry: {
      location: LatLng;
      location_type: string;
      viewport: { northeast: LatLng; southwest: LatLng };
    };
    place_id: string;
    types: string[];
  }>;
  status: string;
};

export type PlacesSearchResult = {
  results: Array<{
    place_id: string;
    name: string;
    formatted_address: string;
    geometry: { location: LatLng };
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
    types: string[];
  }>;
  status: string;
};

const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

type Feature = {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
  place_type: string[];
  context?: Array<{ id: string; text: string; country_code?: string }>;
  properties?: { categories?: string[]; country_code?: string };
};

async function queryGeocoding(query: string, params: Record<string, string | undefined>): Promise<Feature[]> {
  if (!ENV.maptilerKey) throw new Error("Maps are not configured: set MAPTILER_API_KEY");
  const url = new URL(`${MAPTILER_GEOCODING_URL}/${encodeURIComponent(query)}.json`);
  for (const [name, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(name, value);
  url.searchParams.set("key", ENV.maptilerKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    // Deliberately no URL in the message: it contains the key.
    throw new Error(`MapTiler request failed (${response.status} ${response.statusText})`);
  }
  const body = (await response.json()) as { features?: Feature[] };
  return body.features ?? [];
}

const contextKind = (id: string) => id.split(".")[0];

/** Builds Google-style address_components from a MapTiler feature and its context. */
function addressComponents(feature: Feature): GeocodingResult["results"][number]["address_components"] {
  const components: GeocodingResult["results"][number]["address_components"] = [];
  const add = (name: string, types: string[], shortName = name) => components.push({ long_name: name, short_name: shortName, types });

  const own = feature.place_type;
  const context = feature.context ?? [];
  const find = (kind: string) => context.find(c => contextKind(c.id) === kind);

  // City: the feature itself, else the municipality in its context, else a "place".
  const cityName = own.includes("municipality") || own.includes("place") || own.includes("locality")
    ? feature.text
    : (find("municipality") ?? find("municipal_district") ?? find("place") ?? find("locality"))?.text;
  if (cityName) add(cityName, ["locality", "political"]);

  if (own.includes("postal_code")) add(feature.text, ["postal_code"]);
  else {
    const postal = find("postal_code");
    if (postal) add(postal.text, ["postal_code"]);
  }

  const county = find("county");
  if (county) add(county.text, ["administrative_area_level_2", "political"]);

  const region = find("region");
  if (region) add(region.text, ["administrative_area_level_1", "political"], US_STATES[region.text] ?? region.text);

  const country = find("country");
  const countryCode = (country?.country_code ?? feature.properties?.country_code ?? "").toUpperCase();
  if (country) add(country.text, ["country", "political"], countryCode || country.text);
  return components;
}

function toGeocodingResult(feature: Feature): GeocodingResult["results"][number] {
  const [lng, lat] = feature.center;
  const [west, south, east, north] = feature.bbox ?? [lng, lat, lng, lat];
  return {
    address_components: addressComponents(feature),
    formatted_address: feature.place_name,
    geometry: {
      location: { lat, lng },
      location_type: "APPROXIMATE",
      viewport: { northeast: { lat: north, lng: east }, southwest: { lat: south, lng: west } },
    },
    place_id: feature.id,
    types: feature.place_type,
  };
}

async function geocode(params: Record<string, unknown>): Promise<GeocodingResult> {
  const address = String(params.address ?? "").trim();
  if (!address) return { results: [], status: "ZERO_RESULTS" };
  // Google's "components=country:US" restriction.
  const country = /country:([A-Za-z]{2})/.exec(String(params.components ?? ""))?.[1]?.toLowerCase();
  const features = await queryGeocoding(address, { limit: "1", language: "en", country });
  return features.length ? { results: features.map(toGeocodingResult), status: "OK" } : { results: [], status: "ZERO_RESULTS" };
}

/** "churches in Waukesha, WI" -> ["churches"]; "food pantry and social services in X" -> two terms. */
export function placeSearchTerms(query: string): string[] {
  const withoutPlace = query.toLowerCase().replace(/\s+(?:in|near|around)\s+.+$/, "").replace(/\bpublic\b/g, " ");
  const terms = withoutPlace.split(/\s+and\s+|,/).map(term => term.replace(/\s+/g, " ").trim()).filter(Boolean);
  return terms.length ? terms : [query.trim()];
}

const singular = (term: string) => (/(?:ch|sh|x|ss)es$/.test(term) ? term.slice(0, -2) : /[^s]s$/.test(term) ? term.slice(0, -1) : term);

function boundingBox(center: LatLng, radiusMeters: number): string {
  const dLat = radiusMeters / METERS_PER_DEGREE;
  const dLng = radiusMeters / (METERS_PER_DEGREE * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.01));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat].map(n => n.toFixed(5)).join(",");
}

function addressWithoutName(feature: Feature): string {
  const parts = feature.place_name.split(", ");
  if (parts[0] === feature.text) parts.shift();
  if (parts[parts.length - 1] === "United States") parts.pop();
  return parts.join(", ") || feature.place_name;
}

async function textSearch(params: Record<string, unknown>): Promise<PlacesSearchResult> {
  const query = String(params.query ?? "").trim();
  if (!query) return { results: [], status: "ZERO_RESULTS" };

  const [lat, lng] = String(params.location ?? "").split(",").map(Number);
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);
  const radius = Number(params.radius);
  const common: Record<string, string | undefined> = {
    types: "poi",
    limit: String(POI_LIMIT),
    language: "en",
    country: "us",
    ...(hasCenter ? { proximity: `${lng},${lat}` } : {}),
    ...(hasCenter && Number.isFinite(radius) && radius > 0 ? { bbox: boundingBox({ lat, lng }, radius) } : {}),
  };

  const found = new Map<string, Feature>();
  await Promise.all(
    placeSearchTerms(query).map(async term => {
      let features = await queryGeocoding(term, common);
      if (features.length === 0 && singular(term) !== term) features = await queryGeocoding(singular(term), common);
      for (const feature of features) if (!found.has(feature.id)) found.set(feature.id, feature);
    }),
  );

  const results = [...found.values()].slice(0, MAX_PLACE_RESULTS).map(feature => ({
    place_id: feature.id,
    name: feature.text,
    formatted_address: addressWithoutName(feature),
    geometry: { location: { lat: feature.center[1], lng: feature.center[0] } },
    types: feature.properties?.categories?.length ? feature.properties.categories : ["point_of_interest"],
  }));
  return { results, status: results.length ? "OK" : "ZERO_RESULTS" };
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}

/**
 * Same call shape as before (endpoint plus Google-style params), answered by MapTiler.
 * Only the two endpoints the app uses are supported; anything else is a programming error.
 */
export async function makeRequest<T = unknown>(
  endpoint: string,
  params: Record<string, unknown> = {},
  _options: RequestOptions = {},
): Promise<T> {
  if (endpoint === "/maps/api/geocode/json") return (await geocode(params)) as T;
  if (endpoint === "/maps/api/place/textsearch/json") return (await textSearch(params)) as T;
  throw new Error(`Unsupported map endpoint: ${endpoint}`);
}
