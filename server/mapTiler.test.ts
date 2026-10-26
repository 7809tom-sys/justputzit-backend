import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { makeRequest, placeSearchTerms, type GeocodingResult, type PlacesSearchResult } from "./_core/map";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const madison = {
  id: "municipality.1",
  text: "Madison",
  place_name: "Madison, Wisconsin, United States",
  center: [-89.3842, 43.0747],
  bbox: [-89.5, 42.99, -89.25, 43.17],
  place_type: ["municipality"],
  context: [
    { id: "county.5", text: "Dane" },
    { id: "region.9", text: "Wisconsin", country_code: "us" },
    { id: "country.2", text: "United States", country_code: "us" },
  ],
};
const zip = {
  id: "postal_code.7",
  text: "53202",
  place_name: "53202, Wisconsin, United States",
  center: [-87.8948, 43.044],
  place_type: ["postal_code"],
  context: [
    { id: "neighbourhood.1", text: "Juneau Town" },
    { id: "municipality.3", text: "Milwaukee" },
    { id: "region.9", text: "Wisconsin", country_code: "us" },
    { id: "country.2", text: "United States", country_code: "us" },
  ],
};
const library = {
  id: "poi.10",
  text: "Memorial Library",
  place_name: "Memorial Library, 750 West Main Street, Madison, Wisconsin 53706, United States",
  center: [-87.931, 43.038],
  place_type: ["poi"],
  properties: { categories: ["library"] },
};

let fetchMock: ReturnType<typeof vi.fn>;
const requestedUrl = (call = 0) => new URL(String(fetchMock.mock.calls[call][0]));

describe("MapTiler map shim", () => {
  beforeEach(() => {
    ENV.maptilerKey = "test-key";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    ENV.maptilerKey = "";
  });

  describe("geocoding", () => {
    it("returns Google-shaped results with a state abbreviation, city and coordinates", async () => {
      fetchMock.mockImplementation(async () => json({ features: [madison] }));
      const result = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: "Madison, WI", components: "country:US" });

      expect(result.status).toBe("OK");
      const top = result.results[0];
      expect(top.geometry.location).toEqual({ lat: 43.0747, lng: -89.3842 });
      expect(top.formatted_address).toBe("Madison, Wisconsin, United States");
      const byType = (type: string) => top.address_components.find(c => c.types.includes(type));
      expect(byType("locality")?.long_name).toBe("Madison");
      expect(byType("administrative_area_level_1")).toMatchObject({ long_name: "Wisconsin", short_name: "WI" });
      expect(byType("administrative_area_level_2")?.long_name).toBe("Dane");
      expect(byType("country")?.short_name).toBe("US");
    });

    it("sends the key, the address and the country restriction to MapTiler", async () => {
      fetchMock.mockImplementation(async () => json({ features: [madison] }));
      await makeRequest("/maps/api/geocode/json", { address: "Madison, WI", components: "country:US" });

      const url = requestedUrl();
      expect(url.origin + url.pathname).toBe("https://api.maptiler.com/geocoding/Madison%2C%20WI.json");
      expect(url.searchParams.get("key")).toBe("test-key");
      expect(url.searchParams.get("country")).toBe("us");
      expect(url.searchParams.get("limit")).toBe("1");
    });

    it("takes the city from the context for a ZIP code", async () => {
      fetchMock.mockImplementation(async () => json({ features: [zip] }));
      const { results } = await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: "53202" });
      const types = (type: string) => results[0].address_components.find(c => c.types.includes(type));
      expect(types("postal_code")?.long_name).toBe("53202");
      expect(types("locality")?.long_name).toBe("Milwaukee");
      expect(types("administrative_area_level_1")?.short_name).toBe("WI");
    });

    it("reports ZERO_RESULTS, and does not call MapTiler for an empty address", async () => {
      fetchMock.mockImplementation(async () => json({ features: [] }));
      expect((await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: "zzzz nowhere" })).status).toBe("ZERO_RESULTS");
      fetchMock.mockClear();
      expect((await makeRequest<GeocodingResult>("/maps/api/geocode/json", { address: "  " })).results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("place search", () => {
    it("searches points of interest inside a bounding box around the location", async () => {
      fetchMock.mockImplementation(async () => json({ features: [library] }));
      const { results, status } = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", {
        query: "public library in Madison, WI",
        location: "43.0747,-89.3842",
        radius: 10000,
      });

      const url = requestedUrl();
      expect(decodeURIComponent(url.pathname)).toBe("/geocoding/library.json");
      expect(url.searchParams.get("types")).toBe("poi");
      expect(url.searchParams.get("proximity")).toBe("-89.3842,43.0747");
      const [west, south, east, north] = (url.searchParams.get("bbox") ?? "").split(",").map(Number);
      expect(west).toBeLessThan(-89.3842);
      expect(east).toBeGreaterThan(-89.3842);
      expect(south).toBeLessThan(43.0747);
      expect(north).toBeGreaterThan(43.0747);

      expect(status).toBe("OK");
      expect(results[0]).toEqual({
        place_id: "poi.10",
        name: "Memorial Library",
        formatted_address: "750 West Main Street, Madison, Wisconsin 53706",
        geometry: { location: { lat: 43.038, lng: -87.931 } },
        types: ["library"],
      });
    });

    it("reduces sentence-style queries to keywords", () => {
      expect(placeSearchTerms("churches in Waukesha, WI")).toEqual(["churches"]);
      expect(placeSearchTerms("food pantry and social services in Milwaukee, WI")).toEqual(["food pantry", "social services"]);
      expect(placeSearchTerms("public golf course in Madison")).toEqual(["golf course"]);
      expect(placeSearchTerms("coffee")).toEqual(["coffee"]);
    });

    it("retries the singular when a plural finds nothing, and de-duplicates across terms", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ features: [] })) // "churches"
        .mockResolvedValueOnce(json({ features: [{ ...library, id: "poi.20", text: "St. Mary" }] })); // "church"
      const { results } = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", { query: "churches in Madison, WI" });
      expect(results.map(r => r.name)).toEqual(["St. Mary"]);
      expect(decodeURIComponent(requestedUrl(1).pathname)).toBe("/geocoding/church.json");

      fetchMock.mockReset().mockImplementation(async () => json({ features: [library] }));
      const merged = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", { query: "food pantry and social services in X" });
      expect(merged.results).toHaveLength(1); // same POI returned for both terms
    });

    it("reports ZERO_RESULTS when nothing is found", async () => {
      fetchMock.mockImplementation(async () => json({ features: [] }));
      const result = await makeRequest<PlacesSearchResult>("/maps/api/place/textsearch/json", { query: "unicorn stables" });
      expect(result).toEqual({ results: [], status: "ZERO_RESULTS" });
    });
  });

  describe("errors", () => {
    it("fails clearly when no key is configured, without calling MapTiler", async () => {
      ENV.maptilerKey = "";
      await expect(makeRequest("/maps/api/geocode/json", { address: "Madison" })).rejects.toThrow("MAPTILER_API_KEY");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("never puts the key in an error message", async () => {
      fetchMock.mockImplementation(async () => json({ message: "Invalid key" }, 403));
      const error = await makeRequest("/maps/api/geocode/json", { address: "Madison" }).catch(e => e as Error);
      expect(error.message).toContain("403");
      expect(error.message).not.toContain("test-key");
    });

    it("rejects endpoints it does not implement", async () => {
      await expect(makeRequest("/maps/api/directions/json", {})).rejects.toThrow("Unsupported map endpoint");
    });
  });
});
