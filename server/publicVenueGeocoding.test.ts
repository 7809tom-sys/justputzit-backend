import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/map", () => ({
  makeRequest: vi.fn(),
}));

import { makeRequest } from "./_core/map";
import { geocodePublicVenueAddress } from "./db";

describe("public venue geocoding", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns coordinates from the authenticated map result for a public venue address", async () => {
    vi.mocked(makeRequest).mockResolvedValueOnce({
      status: "OK",
      results: [{ geometry: { location: { lat: 43.0617, lng: -88.1065 } } }],
    } as any);

    await expect(geocodePublicVenueAddress("1900 N. Calhoun Rd, Brookfield, WI 53005"))
      .resolves.toEqual({ lat: 43.0617, lng: -88.1065 });
    expect(makeRequest).toHaveBeenCalledWith("/maps/api/geocode/json", { address: "1900 N. Calhoun Rd, Brookfield, WI 53005" });
  });

  it("returns null for a blank address or an unavailable map response so event ingestion still succeeds", async () => {
    await expect(geocodePublicVenueAddress(null)).resolves.toBeNull();
    vi.mocked(makeRequest).mockRejectedValueOnce(new Error("unavailable"));
    await expect(geocodePublicVenueAddress("2000 N Calhoun Rd, Brookfield, WI 53005")).resolves.toBeNull();
  });
});
