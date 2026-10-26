import { makeRequest, type GeocodingResult } from "./_core/map";

export type ResolvedLocation = {
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  lat: number;
  lng: number;
  displayName: string;
};

function component(result: GeocodingResult["results"][number], type: string) {
  return result.address_components.find((item) => item.types.includes(type));
}

export async function resolveLocationQuery(query: string): Promise<ResolvedLocation | null> {
  const cleaned = query.trim();
  if (cleaned.length < 2) return null;

  const response = await makeRequest<GeocodingResult>("/maps/api/geocode/json", {
    address: cleaned,
    components: "country:US",
  });
  const result = response.results[0];
  if (!result?.geometry?.location) return null;

  const city = component(result, "locality") ?? component(result, "postal_town") ?? component(result, "administrative_area_level_2");
  const state = component(result, "administrative_area_level_1");
  const country = component(result, "country");
  if (!city?.long_name || !state?.short_name) return null;

  return {
    city: city.long_name,
    state: state.short_name,
    country: country?.short_name ?? "US",
    postalCode: component(result, "postal_code")?.long_name,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    displayName: result.formatted_address,
  };
}

export function isValidLocationQuery(query: string) {
  const value = query.trim();
  return value.length >= 2 && value.length <= 120;
}
