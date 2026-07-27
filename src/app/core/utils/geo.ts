import type { TravelMode } from '../models';
 
/**
 * Great-circle ("as the crow flies") distance between two lat/lng points,
 * in kilometers. Uses the haversine formula — accurate enough for the
 * "point of reference" distances shown next to trip legs.
 *
 * For real road distances you'd need a routing API; that's deferred to a
 * post-v1 phase. The disclaimer near the totals block on the trip planner
 * spells this out for the user.
 */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
 
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
 
/**
 * Rough travel-time estimate in minutes for a given straight-line distance
 * and travel mode. Speeds are deliberately conservative:
 *
 *   walking  5 km/h
 *   cycling  15 km/h
 *   driving  40 km/h   (city-ish — too slow for highways, too fast for jams)
 *   transit  25 km/h   (very rough — depends entirely on the city)
 *   auto     same as driving (best generic guess)
 *
 * These are NOT routing estimates. The mockup's disclaimer makes this
 * explicit: "Distances are straight-line approximations — point of
 * reference only. Open in Google Maps for actual road routes."
 */
export function travelMinutes(distanceKm: number, mode: TravelMode): number {
  const kmPerHour = SPEED_KMH[mode];
  if (!kmPerHour) return 0;
  return (distanceKm / kmPerHour) * 60;
}
 
const SPEED_KMH: Record<TravelMode, number> = {
  walking: 5,
  motorcycle: 35, // urban estimate — quicker than cars in traffic, slower on highways
  driving: 40,
  transit: 25,
  auto: 40,
};
 
/**
 * Friendly "5.2 km" / "850 m" string for a distance in km.
 * Switches to meters under 1 km. One decimal otherwise.
 */
export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
 
/**
 * Friendly "~28 min" / "~2 h 15 min" / "~3 h" string for a minute count.
 * The leading "~" is part of the value, not the caller's job — emphasizes
 * that these are estimates.
 */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  const remainder = m % 60;
  if (remainder === 0) return `~${h} h`;
  return `~${h} h ${remainder} min`;
}
/**
 * A rectangular geographic viewport, in the same shape Leaflet's
 * `LatLngBounds` exposes via getSouth/getNorth/getWest/getEast.
 *
 * This is the single unit the map viewport speaks in. In v1 it's used to
 * filter already-loaded places down to what's on screen (so Leaflet only
 * renders visible markers). In v2 the exact same bounds become the query
 * params for a `/places/viewport` backend call — the shape doesn't change,
 * only who does the filtering.
 */
export interface MapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
 
/**
 * True if a point falls inside the given bounds. Longitude comparison is
 * the naive one that does NOT handle the antimeridian (±180° wrap) — that's
 * fine for a personal places app; nobody's viewport straddles the date line
 * at a useful zoom. If that ever matters, special-case minLng > maxLng.
 */
export function isWithinBounds(
  point: { lat: number; lng: number },
  b: MapBounds
): boolean {
  return (
    point.lat >= b.minLat &&
    point.lat <= b.maxLat &&
    point.lng >= b.minLng &&
    point.lng <= b.maxLng
  );
}
 
/**
 * Grow bounds outward by a fraction of their own span on every side. A
 * small pad (e.g. 0.2 = 20%) means markers just off the edge are already
 * rendered when they scroll into view, killing the "pop-in" you'd otherwise
 * see at the viewport border during a pan.
 */
export function padBounds(b: MapBounds, fraction: number): MapBounds {
  const latPad = (b.maxLat - b.minLat) * fraction;
  const lngPad = (b.maxLng - b.minLng) * fraction;
  return {
    minLat: b.minLat - latPad,
    maxLat: b.maxLat + latPad,
    minLng: b.minLng - lngPad,
    maxLng: b.maxLng + lngPad,
  };
}