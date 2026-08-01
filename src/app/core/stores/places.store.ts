import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { AppStateStore } from './app-state.store';
import type { Place } from '../models';

interface PlacesState {
  entities: Place[];
  loading: boolean;
  error: string | null;
}

const initialState: PlacesState = { entities: [], loading: false, error: null };

/**
 * Canonical signal store. Other entity stores follow this exact shape:
 * - entities[] + loading + error
 * - load / add / update / remove
 * - computed selectors
 * - delegate persistence to the storage adapter
 * 
 * 
 * Soft-deleted places (those with deletedAt set) are filtered out at load time.
 * The records remain in IndexedDB for potential future restore but never enter
 * the store's state.
 */
export const PlacesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    count: computed(() => store.entities().length),
    visited: computed(() => store.entities().filter((p) => p.status === 'visited')),
    planned: computed(() => store.entities().filter((p) => p.status === 'planned')),
    favorites: computed(() => store.entities().filter((p) => p.isFavorite)),
    byCategory: computed(() => {
      const grouped: Record<string, Place[]> = {};
      for (const p of store.entities()) {
        (grouped[p.categoryId] ??= []).push(p);
      }
      return grouped;
    }),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);
    const appState = inject(AppStateStore);

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        const all = await storage.getPlaces();
        // Filter out soft-deleted places at load time
        const entities = all.filter((p) => !p.deletedAt);
        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    async function add(place: Place) {
      await storage.upsertPlace(place);
      patchState(store, { entities: [...store.entities(), place] });
      appState.recordChange();
    }
    
    async function update(place: Place) {
      const updated = { ...place, updatedAt: new Date().toISOString() };
      await storage.upsertPlace(updated);
      patchState(store, {
        entities: store.entities().map((p) => (p.id === place.id ? updated : p)),
      });
      appState.recordChange();
    }

    async function remove(id: string) {
      await storage.deletePlace(id);
      patchState(store, { entities: store.entities().filter((p) => p.id !== id) });
      appState.recordChange();
    }

    /**
     * Partial update: pass an id and the fields you want to change.
     * Handles touching updatedAt and merging on top of the current record.
     * Returns the updated Place, or null if no record with that id exists.
     */
    async function updatePartial(id: string, partial: Partial<Place>): Promise<Place | null> {
      const current = store.entities().find((p) => p.id === id);
      if (!current) return null;
      const updated: Place = {
        ...current,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      await storage.upsertPlace(updated);
      patchState(store, {
        entities: store.entities().map((p) => (p.id === id ? updated : p)),
      });
      appState.recordChange();
      return updated;
    }

    /**
     * Soft-delete: marks the record with deletedAt but keeps it in IndexedDB.
     * Removes from the in-memory entities so the UI updates immediately.
     */
    async function softDelete(id: string): Promise<void> {
      const current = store.entities().find((p) => p.id === id);
      if (!current) return;
      const now = new Date().toISOString();
      const deleted: Place = { ...current, deletedAt: now, updatedAt: now };
      await storage.upsertPlace(deleted);
      patchState(store, {
        entities: store.entities().filter((p) => p.id !== id),
      });
      appState.recordChange();
    }


    function getById(id: string): Place | undefined {
      return store.entities().find((p) => p.id === id);
    }

    /**
     * Called by SyncService after a pull. Merges server records into the
     * local store and IndexedDB without touching lastChangeAt — these are
     * server records, not user mutations.
     *
     * Strategy: last-write-wins by updatedAt. If the incoming record is
     * newer (or not present locally), upsert it. Tombstones (deletedAt set)
     * are written to IndexedDB but removed from in-memory entities.
     */
        async function applyRemote(incoming: Place[]): Promise<void> {
      if (!incoming.length) return;
      const current = new Map(store.entities().map((p) => [p.id, p]));
 
      // Also load tombstones from storage so we can compare against them
      const allLocal = await storage.getPlaces();
      const allById = new Map(allLocal.map((p) => [p.id, p]));
 
      const nextEntities = [...store.entities()];
 
      for (const raw of incoming) {
        // Defensive normalization: a server row (or an imported file, or a
        // future adapter) can arrive with null/absent array fields. Downstream
        // code does p.collectionIds.includes() and p.vibeTagIds.length, which
        // throw on undefined. Guarantee arrays here, at the single point where
        // remote data enters the store.
        const remote: Place = {
          ...raw,
          vibeTagIds: raw.vibeTagIds ?? [],
          collectionIds: raw.collectionIds ?? [],
          visits: raw.visits ?? [],
        };
 
        const local = allById.get(remote.id);
        // Skip if local is newer
        if (local && local.updatedAt >= remote.updatedAt) continue;
 
        await storage.upsertPlace(remote);
 
        if (remote.deletedAt) {
          // Tombstone — remove from in-memory list
          const idx = nextEntities.findIndex((p) => p.id === remote.id);
          if (idx !== -1) nextEntities.splice(idx, 1);
        } else {
          const idx = nextEntities.findIndex((p) => p.id === remote.id);
          if (idx !== -1) nextEntities[idx] = remote;
          else nextEntities.push(remote);
        }
      }

      patchState(store, { entities: nextEntities });
    }
 
    return { load, add, update, updatePartial, remove, softDelete, getById, applyRemote };
  })
);