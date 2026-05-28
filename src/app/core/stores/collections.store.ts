import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { IdService } from '../services/id.service';
import { AppStateStore } from './app-state.store';
import { randomGradientId, DEFAULT_COVER_ICON } from '../constants/collection-covers';
import type { Collection } from '../models';

interface CollectionsState {
  entities: Collection[];
  loading: boolean;
  error: string | null;
}

const initialState: CollectionsState = {
  entities: [],
  loading: false,
  error: null,
};

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
    const idService = inject(IdService);
    const appState = inject(AppStateStore);

    /**
     * Loads collections and backfills cover fields for any that don't have
     * them yet (one-time migration for collections created before Phase 3c).
     * Backfilled records get persisted so this only runs once per record.
     */
    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        const raw = await storage.getCollections();
        const live = raw.filter((c) => !c.deletedAt);

        // Backfill: any collection missing coverGradient or coverIcon gets
        // assigned defaults and persisted in-place.
        const entities: Collection[] = [];
        for (const c of live) {
          if (!c.coverGradient || !c.coverIcon) {
            const upgraded: Collection = {
              ...c,
              coverGradient: c.coverGradient ?? randomGradientId(),
              coverIcon: c.coverIcon ?? DEFAULT_COVER_ICON,
            };
            await storage.upsertCollection(upgraded);
            entities.push(upgraded);
          } else {
            entities.push(c);
          }
        }

        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    /**
     * Creates a new collection with a random gradient + folder icon.
     * User can edit either later via the Settings icon picker (Phase 3c)
     * or the Phase 4 gradient editor.
     */
    async function create(name: string): Promise<Collection> {
      const collection: Collection = {
        id: idService.newId(),
        name: name.trim(),
        coverGradient: randomGradientId(),
        coverIcon: DEFAULT_COVER_ICON,
        visibility: 'private',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storage.upsertCollection(collection);
      patchState(store, { entities: [...store.entities(), collection] });
      appState.recordChange();
      return collection;
    }

    async function add(c: Collection) {
      await storage.upsertCollection(c);
      patchState(store, { entities: [...store.entities(), c] });
      appState.recordChange();
    }

    async function updatePartial(
      id: string,
      partial: Partial<Collection>
    ): Promise<void> {
      const current = store.entities().find((c) => c.id === id);
      if (!current) return;
      const updated: Collection = {
        ...current,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      await storage.upsertCollection(updated);
      patchState(store, {
        entities: store.entities().map((c) => (c.id === id ? updated : c)),
      });
      appState.recordChange();
    }

    async function remove(id: string) {
      await storage.deleteCollection(id);
      patchState(store, { entities: store.entities().filter((c) => c.id !== id) });
      appState.recordChange();
    }

    async function softDelete(id: string): Promise<void> {
      const current = store.entities().find((c) => c.id === id);
      if (!current) return;
      const now = new Date().toISOString();
      const deleted: Collection = { ...current, deletedAt: now, updatedAt: now };
      await storage.upsertCollection(deleted);
      patchState(store, {
        entities: store.entities().filter((c) => c.id !== id),
      });
      appState.recordChange();
    }

    function getById(id: string): Collection | undefined {
      return store.entities().find((c) => c.id === id);
    }

    return { create, load, add, updatePartial, remove, softDelete, getById };
  })
);