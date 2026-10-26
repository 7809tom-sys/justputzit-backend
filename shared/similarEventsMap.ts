export type MappableSimilarEvent = {
  id: number;
  venueLat?: number | string | null;
  venueLng?: number | string | null;
};

export function getMappableSimilarEvents<T extends MappableSimilarEvent>(events: T[]) {
  return events.filter((event) => {
    if (event.venueLat == null || event.venueLng == null) return false;
    const lat = Number(event.venueLat);
    const lng = Number(event.venueLng);
    return Number.isFinite(lat) && Number.isFinite(lng);
  });
}

export function getSimilarEventsMapCenter(events: MappableSimilarEvent[]) {
  const mappable = getMappableSimilarEvents(events);
  if (mappable.length === 0) return null;
  const total = mappable.reduce((acc, event) => ({
    lat: acc.lat + Number(event.venueLat),
    lng: acc.lng + Number(event.venueLng),
  }), { lat: 0, lng: 0 });
  return { lat: total.lat / mappable.length, lng: total.lng / mappable.length };
}

export function getSimilarEventsMapPoints<T extends MappableSimilarEvent>(events: T[]) {
  const mappable = getMappableSimilarEvents(events);
  if (mappable.length === 0) return [] as Array<{ event: T; x: number; y: number }>;
  const latitudes = mappable.map((event) => Number(event.venueLat));
  const longitudes = mappable.map((event) => Number(event.venueLng));
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.002);
  const lngRange = Math.max(maxLng - minLng, 0.002);

  return mappable.map((event) => ({
    event,
    x: 12 + ((Number(event.venueLng) - minLng) / lngRange) * 76,
    y: 12 + (1 - (Number(event.venueLat) - minLat) / latRange) * 76,
  }));
}
