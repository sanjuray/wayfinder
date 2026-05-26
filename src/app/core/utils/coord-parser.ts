/**
 * Parses coordinate strings in common formats.
 *
 * Supported inputs:
 *   17.3486, 78.5524
 *   17.3486°N, 78.5524°E
 *   17.3486° N, 78.5524° E
 *   N17.3486 E78.5524
 *   17° 20' 54.96" N, 78° 33' 8.64" E
 *
 * Returns null if the string doesn't match any recognized coordinate format.
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const cleaned = input.trim();

  // Try DMS first (most specific format)
  const dms = parseDMS(cleaned);
  if (dms) return dms;

// Try decimal with hemisphere prefix: N17.3486 E78.5524
  const prefixed = parseHemispherePrefix(cleaned);
  if (prefixed) return prefixed;

  // Try decimal with degree symbol: 17.3486°N, 78.5524°E (with optional space and hemisphere)
  const degree = parseDegreeSymbol(cleaned);
  if (degree) return degree;

  // Try plain decimal pair: 17.3486, 78.5524
  const plain = parsePlainDecimal(cleaned);
  if (plain) return plain;

  return null;
}

/**
 * Matches: 17.3486, 78.5524
 *          17.3486 78.5524
 *          17.3486;78.5524
 */
function parsePlainDecimal(s: string): { lat: number; lng: number } | null {
  const match = s.match(/^(-?\d{1,3}(?:\.\d+)?)[\s,;]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Matches: 17.3486°N, 78.5524°E
 *          17.3486° N, 78.5524° E
 *          17.3486 N 78.5524 E
 */
function parseDegreeSymbol(s: string): { lat: number; lng: number } | null {
  // Capture: number, optional ° symbol, optional space, hemisphere letter
  const re = /(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NSEWnsew])\b/g;
  const matches = Array.from(s.matchAll(re));
  if (matches.length !== 2) return null;

  let lat: number | null = null;
  let lng: number | null = null;

  for (const m of matches) {
    const value = parseFloat(m[1]);
    const hemisphere = m[2].toUpperCase();
    if (hemisphere === 'N') lat = value;
    else if (hemisphere === 'S') lat = -value;
    else if (hemisphere === 'E') lng = value;
    else if (hemisphere === 'W') lng = -value;
  }

if (lat === null || lng === null) return null;
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

/**
 * Matches: N17.3486 E78.5524
 *          N17.3486, E78.5524
 */
function parseHemispherePrefix(s: string): { lat: number; lng: number } | null {
  const re = /([NSEWnsew])\s*(-?\d{1,3}(?:\.\d+)?)/g;
  const matches = Array.from(s.matchAll(re));
  if (matches.length !== 2) return null;

  let lat: number | null = null;
  let lng: number | null = null;

  for (const m of matches) {
    const hemisphere = m[1].toUpperCase();
    const value = parseFloat(m[2]);
    if (hemisphere === 'N') lat = value;
    else if (hemisphere === 'S') lat = -value;
    else if (hemisphere === 'E') lng = value;
    else if (hemisphere === 'W') lng = -value;
  }

if (lat === null || lng === null) return null;
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}


/**
 * Matches: 17° 20' 54.96" N, 78° 33' 8.64" E
 *          17°20'54.96"N 78°33'8.64"E
 */
function parseDMS(s: string): { lat: number; lng: number } | null {
  // Each coordinate: degrees ° minutes ' seconds " hemisphere
  const re =
    /(\d{1,3})\s*°\s*(\d{1,2})\s*['\u2032]\s*(\d{1,2}(?:\.\d+)?)\s*["\u2033]\s*([NSEWnsew])/g;
  const matches = Array.from(s.matchAll(re));
  if (matches.length !== 2) return null;

  let lat: number | null = null;
  let lng: number | null = null;

  for (const m of matches) {
    const deg = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const sec = parseFloat(m[3]);
const hemisphere = m[4].toUpperCase();
    let value = deg + min / 60 + sec / 3600;
    if (hemisphere === 'S' || hemisphere === 'W') value = -value;
    if (hemisphere === 'N' || hemisphere === 'S') lat = value;
    else lng = value;
  }

  if (lat === null || lng === null) return null;
  if (!isValidLatLng(lat, lng)) return null;
  return { lat, lng };
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

