import type { Place, Collection, Trip, Category, VibeTag, AppState } from '../models';

/**
 * The single contract between the app and "where data lives."
 *
 * v1 implementation: LocalStorageAdapter (Dexie / IndexedDB).
 * v2 implementation: SupabaseAdapter (or whichever cloud).
 *
 * Components NEVER touch this directly; stores do, components touch stores.
 * See ARCHITECTURE.md → Storage discipline.
 */

export type ImportMode = 'merge' | 'replace' | 'import-as-new';

export interface ImportResult {
  imported: number;
  skipped: number;
  conflicts: number;
}

export interface WayfinderEnvelope{
  wayfinder: {
    schemaVersion: 1;
    exportedAt: string;
    exportedBy: string;
    checksum: string;
  };
  data: {
    places: Place[];
    collections: Collection[];
    trips: Trip[],
    categories: Category[];
    vibeTags: VibeTag[];
    appState?: AppState;
  }
}

export interface StorageAdapter {
  // Places
  getPlaces(): Promise<Place[]>;
  getPlace(id: string): Promise<Place | undefined>;
  upsertPlace(place: Place): Promise<void>;
  deletePlace(id: string): Promise<void>;

  // Collections
  getCollections(): Promise<Collection[]>;
  upsertCollection(c: Collection): Promise<void>;
  deleteCollection(id: string): Promise<void>;

  // Trips
  getTrips(): Promise<Trip[]>;
  upsertTrip(t: Trip): Promise<void>;
  deleteTrip(id: string): Promise<void>;

  // Categories
  getCategories(): Promise<Category[]>;
  upsertCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  // Vibe tags
  getVibeTags(): Promise<VibeTag[]>;
  upsertVibeTag(t: VibeTag): Promise<void>;
  deleteVibeTag(id: string): Promise<void>;

  // App state
  getAppState(): Promise<AppState | undefined>;
  setAppState(s: AppState): Promise<void>;

  // Maintenance
  exportAll(): Promise<WayfinderEnvelope>; // returns the watermarked JSON envelope
  importAll(envelope: unknown, mode: ImportMode): Promise<ImportResult>;
  clear(): Promise<void>;
}