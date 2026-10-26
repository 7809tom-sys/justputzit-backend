import { describe, expect, it, vi } from "vitest";

const { makeRequest } = vi.hoisted(() => ({ makeRequest: vi.fn() }));
vi.mock("./_core/map", () => ({ makeRequest }));

import { isValidLocationQuery, resolveLocationQuery } from "./locationResolver";

describe("manual location resolver", () => {
  it("accepts city names and ZIP codes as search input", () => {
    expect(isValidLocationQuery("Madison, WI")).toBe(true);
    expect(isValidLocationQuery("53703")).toBe(true);
    expect(isValidLocationQuery(" ")).toBe(false);
  });

  it("returns a normalized city, state, postal code, and coordinates", async () => {
    makeRequest.mockResolvedValueOnce({
      results: [{
        formatted_address: "Madison, WI 53703, USA",
        geometry: { location: { lat: 43.0748, lng: -89.3848 } },
        address_components: [
          { long_name: "Madison", short_name: "Madison", types: ["locality"] },
          { long_name: "Wisconsin", short_name: "WI", types: ["administrative_area_level_1"] },
          { long_name: "53703", short_name: "53703", types: ["postal_code"] },
          { long_name: "United States", short_name: "US", types: ["country"] },
        ],
      }],
    });

    await expect(resolveLocationQuery("53703")).resolves.toMatchObject({
      city: "Madison",
      state: "WI",
      postalCode: "53703",
      lat: 43.0748,
      lng: -89.3848,
    });
  });

  it("returns null when the map service has no matching US result", async () => {
    makeRequest.mockResolvedValueOnce({ results: [] });
    await expect(resolveLocationQuery("not a real place")).resolves.toBeNull();
  });
});
