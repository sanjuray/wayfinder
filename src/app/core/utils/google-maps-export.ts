import type { TravelMode } from '../models';

/**
 * Build a Google Maps "directions" URL from a list of stop coordinates.
 *
 * Format:
 *   https://www.google.com/maps/dir/?api=1
 *     &origin=<lat>,<lng>
 *     &destination=<lat>,<lng>
 *     &waypoints=<lat>,<lng>|<lat>,<lng>|...
 *     &travelmode=<walking|driving|bicycling|transit>
 *
 * Google Maps' web URL API supports up to 9 waypoints in addition to origin
 * and destination — so the total cap is 11 stops. Longer trips need to be
 * split across multiple URLs (`splitForGoogleMaps` below).
 *
 * Wayfinder's "auto" travel mode maps to *omitting* the travelmode param,
 * letting Google decide based on context.
 */
/**
 * A stop in a Google Maps directions URL. Always has coords (used as the
 * last-resort fallback); may optionally carry a `query` string (a name,
 * an address, anything Google's search-style param accepts). When `query`
 * is set, it's used in place of "lat,lng" — handy when Google's reverse
 * geocode of the coords lands on the wrong building, but the place's name
 * resolves correctly.
 */
export interface GoogleMapsStop {
  lat: number;
  lng: number;
  query?: string;
}

export const GOOGLE_MAPS_MAX_STOPS = 11;

/**
 * Build a single Google Maps URL. Returns null if there are fewer than 2
 * stops (no route to draw) or more than GOOGLE_MAPS_MAX_STOPS (caller should
 * use `splitForGoogleMaps` to chunk first).
 */
export function buildGoogleMapsUrl(
  stops: GoogleMapsStop[],
  mode: TravelMode
): string | null {
  if (stops.length < 2 || stops.length > GOOGLE_MAPS_MAX_STOPS) return null;

  const params = new URLSearchParams();
  params.set('api', '1');
  params.set('origin', formatStop(stops[0]));
  params.set('destination', formatStop(stops[stops.length - 1]));

  if (stops.length > 2) {
    const waypoints = stops
      .slice(1, -1)
      .map(formatStop)
      .join('|');
    params.set('waypoints', waypoints);
  }

  const gmode = GOOGLE_MAPS_MODE[mode];
  if (gmode) params.set('travelmode', gmode);

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Split a long stops list into URL-able chunks. Each chunk overlaps with
 * the next by one stop so the user can follow them in sequence without
 * losing context (chunk N ends where chunk N+1 starts).
 *
 * A trip with 20 stops becomes [0..10], [10..19] — two URLs.
 */
export function splitForGoogleMaps(
  stops: GoogleMapsStop[]
): GoogleMapsStop[][] {
  if (stops.length <= GOOGLE_MAPS_MAX_STOPS) return [stops];
  const chunks: GoogleMapsStop[][] = [];
  let i = 0;
  while (i < stops.length - 1) {
    const end = Math.min(i + GOOGLE_MAPS_MAX_STOPS, stops.length);
    chunks.push(stops.slice(i, end));
    // Overlap by one stop so chunks form a continuous route
    i = end - 1;
  }
  return chunks;
}

/**
 * Format a stop for inclusion in a directions URL. Prefers the explicit
 * `query` string (name, address, etc.) when present; otherwise falls back
 * to "lat,lng" coordinates. URLSearchParams handles encoding at the param-
 * set call site, so this returns a raw string either way.
 *
 * Why not always coords? Google often resolves "lat,lng" to a generic pin
 * at those coordinates, even when the user's saved place has a recognizable
 * name that would surface a real business / landmark with photos, hours,
 * etc. Letting the caller specify a query per stop trades the precision of
 * coords for the richness of named places — the user gets to choose per
 * place which one is better (Phase 6d: Place.googleMapsQueryKey).
 */
function formatStop(s: GoogleMapsStop): string {
  return s.query?.trim() || `${s.lat},${s.lng}`;
}

/**
 * Wayfinder's TravelMode → Google Maps' travelmode parameter value. 'auto'
 * maps to undefined (param is omitted; Google picks).
 *
 * 'motorcycle' maps to Google's documented 'two-wheeler' mode (per their
 * Maps URL API docs — "two-wheeler refers to two-wheeled motorized
 * vehicles such as motorcycles"). Coverage varies by region; in
 * uncovered regions Google falls back to driving routing.
 */
const GOOGLE_MAPS_MODE: Record<TravelMode, string | undefined> = {
  auto: undefined,
  walking: 'walking',
  driving: 'driving',
  motorcycle: 'two-wheeler',
  transit: 'transit',
};