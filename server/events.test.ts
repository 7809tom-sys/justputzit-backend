import { describe, it, expect } from "vitest";
import { getCommunityEvents, createCommunityEvent, rsvpToEvent, getUserEventRsvps } from "./db";

describe("community events", () => {
  it("getCommunityEvents returns an array (even without DB)", async () => {
    const result = await getCommunityEvents({ limit: 5 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("getCommunityEvents accepts city filter", async () => {
    const result = await getCommunityEvents({ city: "Milwaukee", limit: 10 });
    expect(Array.isArray(result)).toBe(true);
    result.forEach((e) => {
      expect(e.city).toBe("Milwaukee");
    });
  });

  it("getCommunityEvents accepts isFree filter", async () => {
    const result = await getCommunityEvents({ isFree: true, limit: 20 });
    expect(Array.isArray(result)).toBe(true);
    result.forEach((e) => {
      expect(e.isFree).toBe(true);
    });
  });

  it("getEventbriteEvents returns empty array when no token", async () => {
    const { getEventbriteEvents } = await import("./db");
    const result = await getEventbriteEvents("Milwaukee", "");
    expect(result).toEqual([]);
  });
});
