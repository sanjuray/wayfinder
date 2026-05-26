import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
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
    }
    
    async function update(place: Place) {
      const updated = { ...place, updatedAt: new Date().toISOString() };
      await storage.upsertPlace(updated);
      patchState(store, {
        entities: store.entities().map((p) => (p.id === place.id ? updated : p)),
      });
    }

    async function remove(id: string) {
      await storage.deletePlace(id);
      patchState(store, { entities: store.entities().filter((p) => p.id !== id) });
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
    }


    function getById(id: string): Place | undefined {
      return store.entities().find((p) => p.id === id);
    }

    return { load, add, update, updatePartial, remove, softDelete, getById };
  })
);