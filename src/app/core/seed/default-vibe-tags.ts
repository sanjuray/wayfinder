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

export const DEFAULT_VIBE_TAGS: Omit<VibeTag, 'id'>[] = DEFAULT_VIBE_TAG_NAMES.map((name) => ({
  name,
  isDefault: true,
}));