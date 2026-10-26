import { describe, expect, it } from "vitest";
import { getMappableSimilarEvents, getSimilarEventsMapCenter, getSimilarEventsMapPoints } from "../shared/similarEventsMap";

const events = [
  { id: 1, venueLat: "43.020", venueLng: "-88.230" },
  { id: 2, venueLat: "43.000", venueLng: "-88.210" },
  { id: 3, venueLat: null, venueLng: null },
];

describe("Similar Events map helpers", () => {
  it("keeps only events with usable coordinates and centers on their midpoint", () => {
    expect(getMappableSimilarEvents(events).map((event) => event.id)).toEqual([1, 2]);
    const center = getSimilarEventsMapCenter(events);
    expect(center?.lat).toBeCloseTo(43.01, 8);
    expect(center?.lng).toBeCloseTo(-88.22, 8);
    expect(getSimilarEventsMapPoints(events).map((point) => point.event.id)).toEqual([1, 2]);
  });
});
