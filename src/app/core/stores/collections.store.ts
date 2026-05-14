import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import type { Collection } from '../models';

interface CollectionsState {
  entities: Collection[];
  loading: boolean;
  error: string | null;
}

const initialState: CollectionsState = { entities: [], loading: false, error: null };

export const CollectionsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    count: computed(() => store.entities().length),
    sorted: computed(() =>
      [...store.entities()].sort((a, b) => a.name.localeCompare(b.name))
    ),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        const entities = await storage.getCollections();
        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    async function add(c: Collection) {
      await storage.upsertCollection(c);
      patchState(store, { entities: [...store.entities(), c] });
    }

    async function update(c: Collection) {
      const updated = { ...c, updatedAt: new Date().toISOString() };
      await storage.upsertCollection(updated);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === c.id ? updated : x)),
      });
    }

    async function remove(id: string) {
      await storage.deleteCollection(id);
      patchState(store, { entities: store.entities().filter((c) => c.id !== id) });
    }

    function getById(id: string): Collection | undefined {
      return store.entities().find((c) => c.id === id);
    }

    return { load, add, update, remove, getById };
  })
);