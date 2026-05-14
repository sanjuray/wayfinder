import { Injectable } from '@angular/core';
import Dexie from 'dexie';
import { db, APP_STATE_KEY } from './db';
import type {
  StorageAdapter,
  ImportMode,
  ImportResult,
  WayfinderEnvelope,
} from './storage.adapter';
import type { Place, Collection, Trip, Category, VibeTag, AppState } from '../models';

/**
 * v1 storage: IndexedDB via Dexie. All deletes are soft-deletes
 * (set deletedAt) so v2 sync can reconcile tombstones.
 */
@Injectable({ providedIn: 'root' })
export class LocalStorageAdapter implements StorageAdapter {
  // ---- Places ----
  async getPlaces(): Promise<Place[]> {
    return db.places.filter((p) => !p.deletedAt).toArray();
  }
  async getPlace(id: string): Promise<Place | undefined> {
    const p = await db.places.get(id);
    return p && !p.deletedAt ? p : undefined;
  }
  async upsertPlace(place: Place): Promise<void> {
    await db.places.put(place);
  }

  async deletePlace(id: string): Promise<void> {
    const existing = await db.places.get(id);
    if (existing) {
      await db.places.put({ ...existing, deletedAt: new Date().toISOString() });
    }
  }

  // ---- Collections ----
  async getCollections(): Promise<Collection[]> {
    return db.collections.filter((c) => !c.deletedAt).toArray();
  }
  async upsertCollection(c: Collection): Promise<void> {
    await db.collections.put(c);
  }
  async deleteCollection(id: string): Promise<void> {
    const existing = await db.collections.get(id);
    if (existing) {
      await db.collections.put({ ...existing, deletedAt: new Date().toISOString() });
    }
  }

  // ---- Trips ----
  async getTrips(): Promise<Trip[]> {
    return db.trips.filter((t) => !t.deletedAt).toArray();
  }

  async upsertTrip(t: Trip): Promise<void> {
    await db.trips.put(t);
  }
  async deleteTrip(id: string): Promise<void> {
    const existing = await db.trips.get(id);
    if (existing) {
      await db.trips.put({ ...existing, deletedAt: new Date().toISOString() });
    }
  }

  // ---- Categories ----
  async getCategories(): Promise<Category[]> {
    return db.categories.toArray();
  }
  async upsertCategory(c: Category): Promise<void> {
    await db.categories.put(c);
  }
  async deleteCategory(id: string): Promise<void> {
    await db.categories.delete(id);
  }

  // ---- Vibe tags ----
  async getVibeTags(): Promise<VibeTag[]> {
    return db.vibeTags.toArray();
  }
  async upsertVibeTag(t: VibeTag): Promise<void> {
    await db.vibeTags.put(t);
  }
  async deleteVibeTag(id: string): Promise<void> {
    await db.vibeTags.delete(id);
  }

  // ---- App state ----
  async getAppState(): Promise<AppState | undefined> {
    const rec = await db.appState.get(APP_STATE_KEY);
    return rec?.state;
  }
  async setAppState(state: AppState): Promise<void> {
    await db.appState.put({ key: APP_STATE_KEY, state });
  }

  // ---- Maintenance ----
  async exportAll(): Promise<WayfinderEnvelope> {
    const data = {
      places: await db.places.toArray(),
      collections: await db.collections.toArray(),
      trips: await db.trips.toArray(),
      categories: await db.categories.toArray(),
      vibeTags: await db.vibeTags.toArray(),
      appState: await this.getAppState(),
    };
    return {
      wayfinder: {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: 'wayfinder-web-v1.0.0',
        checksum: await sha256(JSON.stringify(data)),
      },
      data,
    };
  }

  async importAll(envelope: unknown, mode: ImportMode): Promise<ImportResult> {
    const parsed = this.validateEnvelope(envelope);

    const recomputed = await sha256(JSON.stringify(parsed.data));
    if (recomputed !== parsed.wayfinder.checksum) {
      throw new Error(
        'Backup file checksum mismatch — file may be corrupted or modified.'
      );
    }

    switch (mode) {
      case 'replace':
        return this.importReplace(parsed.data);
      case 'import-as-new':
        return this.importAsNew(parsed.data);
      case 'merge':
      default:
        return this.importMerge(parsed.data);
    }
  }

  async clear(): Promise<void> {
    await db.transaction('rw', db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()));
    });
  }

  // ---- Private import helpers ----

  private validateEnvelope(envelope: unknown): WayfinderEnvelope {
    if (!envelope || typeof envelope !== 'object') {
      throw new Error('Not a valid Wayfinder backup file.');
    }
    const e = envelope as Partial<WayfinderEnvelope>;
    if (!e.wayfinder || !e.data) {
      throw new Error('Missing wayfinder envelope or data section.');
    }
    if (e.wayfinder.schemaVersion !== 1) {
      throw new Error(
        'Unsupported schema version: ${e.wayfinder.schemaVersion}. Expected 1.'
      );
    }
    if (typeof e.wayfinder.checksum !== 'string') {
      throw new Error('Missing or invalid checksum.');
    }
    return e as WayfinderEnvelope;
  }

  private async importReplace(data: WayfinderEnvelope['data']): Promise<ImportResult> {
    await this.clear();

    const imported =
      data.places.length +
      data.collections.length +
      data.trips.length +
      data.categories.length +
      data.vibeTags.length;

    await db.transaction('rw', db.tables, async () => {
      await db.places.bulkPut(data.places);
      await db.collections.bulkPut(data.collections);
      await db.trips.bulkPut(data.trips);
      await db.categories.bulkPut(data.categories);
      await db.vibeTags.bulkPut(data.vibeTags);
      if (data.appState) {
        await db.appState.put({ key: APP_STATE_KEY, state: data.appState });
      }
    });

    return { imported, skipped: 0, conflicts: 0 };
  }

  private async importMerge(data: WayfinderEnvelope['data']): Promise<ImportResult> {
    let imported = 0;
    let skipped = 0;
    let conflicts = 0;

    await db.transaction('rw', db.tables, async () => {
      // Places — reconcile by updatedAt (last-write-wins)
      for (const incoming of data.places) {
        const local = await db.places.get(incoming.id);
        if (!local) {
          await db.places.put(incoming);
          imported++;
        } else if (incoming.updatedAt > local.updatedAt) {
          await db.places.put(incoming);
          conflicts++;
        } else {
          skipped++;
        }
      }
      // Collections — same reconciliation
      for (const incoming of data.collections) {
        const local = await db.collections.get(incoming.id);
        if (!local) {
          await db.collections.put(incoming);
          imported++;
        } else if (incoming.updatedAt > local.updatedAt) {
          await db.collections.put(incoming);
          conflicts++;
        } else {
          skipped++;
        }
      }

      // Trips — same reconciliation
      for (const incoming of data.trips) {
        const local = await db.trips.get(incoming.id);
        if (!local) {
          await db.trips.put(incoming);
          imported++;
        } else if (incoming.updatedAt > local.updatedAt) {
          await db.trips.put(incoming);
          conflicts++;
        } else {
          skipped++;
        }
      }
      // Categories — no updatedAt; just add if missing
      for (const cat of data.categories) {
        const existing = await db.categories.get(cat.id);
        if (!existing) {
          await db.categories.put(cat);
          imported++;
        } else {
          skipped++;
        }
      }

      // Vibe tags — same as categories
      for (const tag of data.vibeTags) {
        const existing = await db.vibeTags.get(tag.id);
        if (!existing) {
          await db.vibeTags.put(tag);
          imported++;
        } else {
          skipped++;
        }
      }

      // App state intentionally NOT merged — would clobber user's current settings.
    });

    return { imported, skipped, conflicts };
  }

  private async importAsNew(data: WayfinderEnvelope['data']): Promise<ImportResult> {
    // Build old-ID → new-ID maps for every entity type, then rewrite cross-references.
    const placeIdMap = new Map<string, string>();
    const collectionIdMap = new Map<string, string>();
    const tripIdMap = new Map<string, string>();
    const categoryIdMap = new Map<string, string>();
    const vibeTagIdMap = new Map<string, string>();

    for (const p of data.places) placeIdMap.set(p.id, crypto.randomUUID());
    for (const c of data.collections) collectionIdMap.set(c.id, crypto.randomUUID());
    for (const t of data.trips) tripIdMap.set(t.id, crypto.randomUUID());
    for (const c of data.categories) categoryIdMap.set(c.id, crypto.randomUUID());
    for (const t of data.vibeTags) vibeTagIdMap.set(t.id, crypto.randomUUID());

    const places: Place[] = data.places.map((p) => ({
      ...p,
      id: placeIdMap.get(p.id)!,
      categoryId: categoryIdMap.get(p.categoryId) ?? p.categoryId,
      vibeTagIds: p.vibeTagIds.map((id) => vibeTagIdMap.get(id) ?? id),
      collectionIds: p.collectionIds.map((id) => collectionIdMap.get(id) ?? id),
    }));

    const collections: Collection[] = data.collections.map((c) => ({
      ...c,
      id: collectionIdMap.get(c.id)!,
    }));

    const trips: Trip[] = data.trips.map((t) => ({
      ...t,
      id: tripIdMap.get(t.id)!,
      stops: t.stops.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        placeId: placeIdMap.get(s.placeId) ?? s.placeId,
      })),
    }));

    const categories: Category[] = data.categories.map((c) => ({
      ...c,
      id: categoryIdMap.get(c.id)!,
    }));

    const vibeTags: VibeTag[] = data.vibeTags.map((t) => ({
      ...t,
      id: vibeTagIdMap.get(t.id)!,
    }));

    const imported =
      places.length + collections.length + trips.length + categories.length + vibeTags.length;

    await db.transaction('rw', db.tables, async () => {
      await db.places.bulkPut(places);
      await db.collections.bulkPut(collections);
      await db.trips.bulkPut(trips);
      await db.categories.bulkPut(categories);
      await db.vibeTags.bulkPut(vibeTags);
    });

    return { imported, skipped: 0, conflicts: 0 };
  }

  
}

  async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return (
    'sha256:' +
    Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}