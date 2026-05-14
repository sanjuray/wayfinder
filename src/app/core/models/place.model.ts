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

export interface Visit {
  id: string;
  date: ISODate;
  rating?: 'thumbs-up' | 'thumbs-down' | 'meh';
  note?: string;
  photoUrls?: string[];
}

export interface Place {
  id: string;
  name: string;
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
  reviewText?: string;
  customNotes?: string;
  sourceUrl?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
  userId?: string;
}