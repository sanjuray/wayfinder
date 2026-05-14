import type { StorageAdapter } from '../core/storage/storage.adapter';
import type { Place, Collection, Trip, Category, VibeTag, AppState } from '../core/models';

/**
 * In-memory implementation of StorageAdapter for tests.
 * Never hit real IndexedDB in tests.
 */
export function fakeStorageAdapter(): StorageAdapter {
  const places: Place[] = [];
  const collections: Collection[] = [];
  const trips: Trip[] = [];
  const categories: Category[] = [];
  const vibeTags: VibeTag[] = [];
  let appState: AppState | undefined;

  return {
    // Places
    getPlaces: async () => places.filter((p) => !p.deletedAt),
    getPlace: async (id) => places.find((p) => p.id === id && !p.deletedAt),
    upsertPlace: async (p) => {
      const i = places.findIndex((x) => x.id === p.id);
      if (i >= 0) places[i] = p;
      else places.push(p);
    },
    deletePlace: async (id) => {
      const p = places.find((x) => x.id === id);
      if (p) p.deletedAt = new Date().toISOString();
    },

    // Collections
    getCollections: async () => collections.filter((c) => !c.deletedAt),
    upsertCollection: async (c) => {
      const i = collections.findIndex((x) => x.id === c.id);
      if (i >= 0) collections[i] = c;
      else collections.push(c);
    },
    deleteCollection: async (id) => {
      const c = collections.find((x) => x.id === id);
      if (c) c.deletedAt = new Date().toISOString();
    },

    // Trips
    getTrips: async () => trips.filter((t) => !t.deletedAt),
    upsertTrip: async (t) => {
      const i = trips.findIndex((x) => x.id === t.id);
      if (i >= 0) trips[i] = t;
      else trips.push(t);
    },
    deleteTrip: async (id) => {
      const t = trips.find((x) => x.id === id);
      if (t) t.deletedAt = new Date().toISOString();
    },

    // Categories
    getCategories: async () => categories,
    upsertCategory: async (c) => {
      const i = categories.findIndex((x) => x.id === c.id);
      if (i >= 0) categories[i] = c;
      else categories.push(c);
    },
    deleteCategory: async (id) => {
      const i = categories.findIndex((x) => x.id === id);
      if (i >= 0) categories.splice(i, 1);
    },

    // Vibe tags
    getVibeTags: async () => vibeTags,
    upsertVibeTag: async (t) => {
      const i = vibeTags.findIndex((x) => x.id === t.id);
      if (i >= 0) vibeTags[i] = t;
      else vibeTags.push(t);
    },
    deleteVibeTag: async (id) => {
      const i = vibeTags.findIndex((x) => x.id === id);
      if (i >= 0) vibeTags.splice(i, 1);
    },

    // App state
    getAppState: async () => appState,
    setAppState: async (s) => {
      appState = s;
    },

    // Maintenance
    exportAll: async () => ({
      wayfinder: {
        schemaVersion: 1 as const,
        exportedAt: new Date().toISOString(),
        exportedBy: 'fake',
        checksum: 'sha256:fake',
      },
      data: {
        places: [...places],
        collections: [...collections],
        trips: [...trips],
        categories: [...categories],
        vibeTags: [...vibeTags],
        appState,
      },
    }),
    importAll: async () => ({ imported: 0, skipped: 0, conflicts: 0 }),
    clear: async () => {
      places.length = 0;
      collections.length = 0;
      trips.length = 0;
      categories.length = 0;
      vibeTags.length = 0;
      appState = undefined;
    },
  };
}