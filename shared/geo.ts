export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const earthRadiusMiles = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatMilesAway(distanceMiles: number | null | undefined): string {
  if (distanceMiles === null || distanceMiles === undefined || !Number.isFinite(distanceMiles)) return "Distance unavailable";
  if (distanceMiles < 0.1) return "Less than 0.1 mi away";
  return `${distanceMiles < 10 ? distanceMiles.toFixed(1) : Math.round(distanceMiles)} mi away`;
}
