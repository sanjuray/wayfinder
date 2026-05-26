import type { CollectionCoverGradient } from '../models';

/**
 * Wayfinder's collection cover system.
 *
 * Each new collection is assigned a random gradient from this palette on
 * creation. The user can change it later (Phase 4 editor). The icon shown
 * on top of the gradient defaults to 'folder' and is editable via the
 * Settings icon picker (Phase 3c).
 *
 * v2 will add image uploads which override the gradient + icon entirely.
 */

export interface GradientSpec {
  id: CollectionCoverGradient;
  /** Display name, used in Phase 4 gradient picker. */
  name: string;
  /** Starting color of the linear gradient. */
  from: string;
  /** Ending color. */
  to: string;
}

/**
 * The 8 presets. Mostly mid-stops from the project's color ramp so they
 * harmonize with category dots and the accent color. Order is deliberate
 * (warm → cool → neutral → spice) but doesn't affect random assignment.
 */
export const GRADIENT_PALETTE: GradientSpec[] = [
  { id: 'sunset',   name: 'Sunset',   from: '#FFAA7B', to: '#E5523F' },
  { id: 'berry',    name: 'Berry',    from: '#D4537E', to: '#72243E' },
  { id: 'forest',   name: 'Forest',   from: '#1D9E75', to: '#04342C' },
  { id: 'treasure', name: 'Treasure', from: '#FFD15B', to: '#854F0B' },
  { id: 'ocean',    name: 'Ocean',    from: '#5BA3E5', to: '#0C447C' },
  { id: 'plum',     name: 'Plum',     from: '#B07FE8', to: '#534AB7' },
  { id: 'slate',    name: 'Slate',    from: '#888780', to: '#2C2C2A' },
  { id: 'spice',    name: 'Spice',    from: '#E89B5B', to: '#7A3F12' },
];

/**
 * The default icon assigned to new collections. User can edit later.
 */
export const DEFAULT_COVER_ICON = 'folder';

/**
 * Returns a random gradient id from the palette. Uses Math.random — not
 * deterministic, so two collections created back-to-back may share a
 * gradient. That's fine; user can edit if they want variety.
 */
export function randomGradientId(): CollectionCoverGradient {
  const idx = Math.floor(Math.random() * GRADIENT_PALETTE.length);
  return GRADIENT_PALETTE[idx].id;
}

/**
 * Returns the CSS gradient string for a given preset id. Falls back to
 * the first preset (sunset) if the id is missing or unknown — keeps the
 * UI usable for any legacy data that didn't get a backfill.
 */
export function gradientCss(id: CollectionCoverGradient | undefined): string {
  const spec = GRADIENT_PALETTE.find((g) => g.id === id) ?? GRADIENT_PALETTE[0];
  return `linear-gradient(135deg, ${spec.from}, ${spec.to})`;
}

/**
 * Returns the `from`/`to` hex pair for a gradient id. Useful when you need
 * the raw colors for something other than CSS (e.g. a 2-color swatch in
 * the Phase 4 picker).
 */
export function gradientColors(id: CollectionCoverGradient | undefined): { from: string; to: string } {
  const spec = GRADIENT_PALETTE.find((g) => g.id === id) ?? GRADIENT_PALETTE[0];
  return { from: spec.from, to: spec.to };
}

