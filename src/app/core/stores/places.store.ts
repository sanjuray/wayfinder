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
        const entities = await storage.getPlaces();
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

    function getById(id: string): Place | undefined {
      return store.entities().find((p) => p.id === id);
    }

    return { load, add, update, remove, getById };
  })
);