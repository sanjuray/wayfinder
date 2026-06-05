import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { IdService } from '../services/id.service';
import { AppStateStore } from './app-state.store';
import { DEFAULT_VIBE_TAGS } from '../seed/default-vibe-tags';
import type { VibeTag } from '../models';

interface VibeTagsState {
  entities: VibeTag[];
  loading: boolean;
  error: string | null;
}

const initialState: VibeTagsState = { entities: [], loading: false, error: null };

export const VibeTagsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    sorted: computed(() =>
      [...store.entities()].sort((a, b) => a.name.localeCompare(b.name))
    ),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);
    const idService = inject(IdService);
    const appState = inject(AppStateStore);

    function nameAvailable(candidate: string, ignoreId?: string): boolean {
      const target = candidate.trim().toLowerCase();
      if (!target) return false;
      return !store.entities().some(
        (t) => t.id !== ignoreId && t.name.trim().toLowerCase() === target
      );
    }

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        let entities = await storage.getVibeTags();

        if (entities.length === 0) {
          entities = DEFAULT_VIBE_TAGS.map((t) => ({ ...t, id: idService.newId() }));
          for (const t of entities) {
            await storage.upsertVibeTag(t);
          }
        }

        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    async function add(t: VibeTag) {
      await storage.upsertVibeTag(t);
      patchState(store, { entities: [...store.entities(), t] });
      appState.recordChange();
    }

    async function update(t: VibeTag) {
      await storage.upsertVibeTag(t);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === t.id ? t : x)),
      });
      appState.recordChange();
    }

    async function remove(id: string) {
      await storage.deleteVibeTag(id);
      patchState(store, { entities: store.entities().filter((t) => t.id !== id) });
      appState.recordChange();
    }

    function getById(id: string): VibeTag | undefined {
      return store.entities().find((t) => t.id === id);
    }

    return { load, add, update, remove, getById, nameAvailable };
  })
);