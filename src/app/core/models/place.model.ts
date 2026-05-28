/**
 * Core domain model — a saved place.
 *
 * Note the v2-readiness fields: stable id, createdAt / updatedAt,
 * soft-delete deletedAt, and stubbed userId. These are populated
 * (where relevant) in v1 even though there's no backend yet — the schema
 * is the migration contract.
 */

export type ISODate = string;

export type PlaceStatus = 'planned' | 'visited';

export type VisitRating = 'thumbs-up' | 'thumbs-down' | 'meh';

export interface Visit {
  id: string;
  date: ISODate;
  rating?: VisitRating;
  note?: string;
  photoUrls?: string[];
  createdAt: ISODate;
}

export interface Place {
  id: string;
  name: string;
  displayAddress?: string;
  lat: number;
  lng: number;
  locality: string;
  region: string;
  country: string;
  categoryId: string;
  vibeTagIds: string[];
  collectionIds: string[];
  status: PlaceStatus;
  isFavorite: boolean;
  visits: Visit[];
  customName?: string;
  reviewText?: string;
  customNotes?: string;
  sourceUrl?: string;
  /**
   * User-saved preferred Google Maps query variant key. Set via the place
   * detail's Open-in-Maps popover ("set as default" checkbox). When set,
   * the facade's googleMapsUrl() and the trip planner's export both use
   * the matching variant from `mapsQueryVariants`. Falls back to the
   * smart default (variants[0]) when unset, or when the stored key no
   * longer matches a real variant (e.g. user cleared the customName so
   * the 'custom-name-and-address' variant disappeared from the list).
   *
   * Stored as a *key*, not a URL, so that future changes to how a
   * variant's URL is built (encoding tweaks, alternative endpoints) don't
   * invalidate saved preferences.
   */
  googleMapsQueryKey?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
  userId?: string;
}