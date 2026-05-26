import type { ISODate } from './place.model';

export type Visibility = 'private' | 'shared' | 'public';

/**
 * Ids of the gradient presets defined in core/constants/collection-covers.ts.
 * Stored as a string so the union can grow without forcing schema migrations.
 */
export type CollectionCoverGradient =
  | 'sunset'
  | 'berry'
  | 'forest'
  | 'treasure'
  | 'ocean'
  | 'plum'
  | 'slate'
  | 'spice';

export interface Collection {
  id: string;
  name: string;

  /**
   * Cover styling fields. Used by the sidebar card + Phase 4 editor.
   *
   * Render precedence (highest first):
   *   1. coverImageUrl  — v2 upload feature
   *   2. coverGradient + coverIcon  — Phase 3c default (random gradient on create, folder icon)
   *   3. fallback defaults  — handled in the render helper
   */
  coverGradient?: CollectionCoverGradient;
  /**
   * Tabler icon name without the `ti-` prefix. Phase 3c default = 'folder'.
   * Any Tabler icon name is valid — user picks from the full library in Settings.
   */
  coverIcon?: string;
  /**
   * v2 image upload. When present, overrides gradient + icon for rendering.
   */
  coverImageUrl?: string;

  ownerId?: string;          // v2 user auth
  collaboratorIds?: string[]; // v2 shared collections
  visibility: Visibility;    // always 'private' in v1
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
}