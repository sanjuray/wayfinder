/**
 * Inline SVG path data for pin glyphs. Each path is drawn inside the
 * teardrop, scaled to fit. Add new entries when you add categories.
 *
 * Names match the icon field on Category records (see default-categories.ts).
 */
export const PIN_ICON_PATHS: Record<string, string> = {
  // Default fallback used when a category's icon name isn't in this map
  circle: '<circle cx="12" cy="12" r="3" />',
  // Default categories — names match seed/default-categories.ts
  'sparkles': '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  'glass': '<path d="M8 3h8v6a4 4 0 0 1-8 0V3zM12 13v8M9 21h6"/>',
  'umbrella': '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v8a2 2 0 0 1-4 0"/>',
  'coffee': '<path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9zM16 11h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2M14 3v2"/>',
  'building': '<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h6"/>',
  'tree': '<path d="M12 13v8M9 21h6M12 3l-4 6h2l-3 4h2l-2 3h10l-2-3h2l-3-4h2z"/>',
  'tools-kitchen-2': '<path d="M19 4l-3 3v3h3l3-3V4M4 4v6c0 1 1 2 2 2v9h2v-9c1 0 2-1 2-2V4M7 4v6"/>',
  'shopping-bag': '<path d="M6 6h12l-1 14H7L6 6zM9 6V4a3 3 0 0 1 6 0v2"/>',
  'bed': '<path d="M3 18v-3a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v3M3 18h18M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3"/>',
  'meat': '<path d="M14 6a4 4 0 1 1 4 4 4 4 0 0 1-2 2c-2 2-2 4-2 6l-2 1c-2 0-4-2-4-4 0 0 2-2 2-4 0-1-1-1-2-1l-2-2c0-1 1-3 3-3l2 2 2-1z"/>',
  'building-arch': '<path d="M4 21V8l8-5 8 5v13M4 21h16M9 21V13a3 3 0 0 1 6 0v8"/>',
  'mountain': '<path d="M3 20l5-9 4 6 3-3 6 6zM12 7l3-4 4 6"/>',
};