import type { VibeTag } from '../models';
 
export const DEFAULT_VIBE_TAG_NAMES: string[] = [
  'budget',
  'chill spot',
  'date-worthy',
  'family-friendly',
  'group-outing',
  'hidden-gem',
  'kid-friendly',
  'solo-spot',
  'splurge',
  'touristy',
];
 
/**
 * Default vibe tags seeded on first launch.
 *
 * IMPORTANT — ids are FIXED (derived from the slugged name), not generated,
 * for the same reason as default categories: deterministic ids make the
 * cross-device upsert idempotent and prevent duplicates on sync. See
 * default-categories.ts for the full rationale. Never change an existing id.
 */
export const DEFAULT_VIBE_TAGS: Omit<VibeTag, 'createdAt' | 'updatedAt'>[] =
  DEFAULT_VIBE_TAG_NAMES.map((name) => ({
    id: 'wf-vibe-' + name.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
    name,
    isDefault: true,
  }));