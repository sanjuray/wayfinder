import Dexie, { Table } from 'dexie';
import type { Place, Collection, Trip, Category, VibeTag, AppState } from '../models';

const APP_STATE_KEY = 'app-state' as const;

interface AppStateRecord {
  key: typeof APP_STATE_KEY;
  state: AppState;
}

export class WayfinderDB extends Dexie {
  places!: Table<Place, string>;
  collections!: Table<Collection, string>;
  trips!: Table<Trip, string>;
  categories!: Table<Category, string>;
  vibeTags!: Table<VibeTag, string>;
  appState!: Table<AppStateRecord, string>;

  constructor() {
    super('wayfinder');
    this.version(1).stores({
      places: 'id, categoryId, status, locality, country, updatedAt, deletedAt',
      collections: 'id, name, updatedAt, deletedAt',
      trips: 'id, plannedDate, isCompleted, updatedAt, deletedAt',
      categories: 'id, name, sortOrder',
      vibeTags: 'id, name',
      appState: 'key',
    });
  }
}

export const db = new WayfinderDB();
export { APP_STATE_KEY };