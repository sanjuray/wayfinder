import type { Place } from '../models';

/**
 * One option in the "Open in Google Maps" picker for a place. Pure data —
 * the URL is built by callers (place-detail's popover renders <a> tags;
 * the trip planner reads just the `query` field to embed in a directions
 * URL).
 */
export interface MapsQueryVariant {
  /** Stable identifier — used as the saved-default key on Place. */
  key: string;
  /** Human-readable label shown in the picker. */
  label: string;
  /** The actual query string that gets fed to Google Maps. */
  query: string;
}

/**
 * Available Google Maps query variants for a place, in priority order.
 * The first entry is the smart default. If the place has a saved
 * `googleMapsQueryKey`, the matching variant is promoted to position 0.
 *
 * This lives in core/utils (not feature code) because both the place
 * detail screen AND the trip planner derive variants from a Place — and
 * the architecture rule forbids features from importing one another.
 *
 * Variants are derived from optional fields on Place. If a required field
 * for a tier is missing (e.g. no customName, no displayAddress), that
 * tier is skipped — never produces an empty-query variant.
 */
export function placeMapsQueryVariants(p: Place): MapsQueryVariant[] {
  const customName = p.customName?.trim();
  const displayAddress = p.displayAddress?.trim();
  const name = p.name?.trim();
  const locality = [p.locality, p.region].filter(Boolean).join(', ');
  const coords = `${p.lat},${p.lng}`;

  const variants: MapsQueryVariant[] = [];

  // Tier 1: customName + displayAddress — most specific, user-named
  if (customName && displayAddress) {
    variants.push({
      key: 'custom-name-and-address',
      label: 'Custom name + address',
      query: `${customName}, ${displayAddress}`,
    });
  }

  // Tier 2: name + displayAddress — fallback when no customName
  if (name && displayAddress) {
    variants.push({
      key: 'name-and-address',
      label: 'Name + address',
      query: `${name}, ${displayAddress}`,
    });
  }

  // Tier 3: customName + city — broader than full address
  if (customName && locality) {
    variants.push({
      key: 'custom-name-and-locality',
      label: 'Custom name + city',
      query: `${customName}, ${locality}`,
    });
  }

  // Tier 4: address only
  if (displayAddress) {
    variants.push({
      key: 'address-only',
      label: 'Address only',
      query: displayAddress,
    });
  }

  // Tier 5: name only
  if (name) {
    variants.push({
      key: 'name-only',
      label: 'Place name only',
      query: name,
    });
  }

  // Tier 6: coordinates — always available
  variants.push({
    key: 'coords',
    label: 'Coordinates',
    query: coords,
  });

  // Promote the user's saved default to position 0 if present and resolvable
  const savedKey = p.googleMapsQueryKey;
  if (savedKey) {
    const idx = variants.findIndex((v) => v.key === savedKey);
    if (idx > 0) {
      const [saved] = variants.splice(idx, 1);
      variants.unshift(saved);
    }
  }

  return variants;
}

/**
 * Just the query string for the place's preferred (or smart-default) Google
 * Maps lookup. Used by the trip planner when building a directions URL.
 * Returns the variants[0].query — i.e., respects the saved default.
 */
export function preferredMapsQuery(p: Place): string {
  return placeMapsQueryVariants(p)[0].query;
}

/**
 * Build a Google Maps "search" URL from a free-form query string. Used by
 * place-detail's popover; each variant gets its own <a href>.
 */
export function buildPlaceMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}