export const CITY_RESEED_MIN_UPCOMING_EVENTS = 10;

export function shouldReseedCity(upcomingEventCount: number, minimum = CITY_RESEED_MIN_UPCOMING_EVENTS) {
  return upcomingEventCount < minimum;
}
