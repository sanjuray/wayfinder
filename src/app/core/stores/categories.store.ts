import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { IdService } from '../services/id.service';
import { AppStateStore } from './app-state.store';
import { DEFAULT_CATEGORIES } from '../seed/default-categories';
import type { Category } from '../models';

interface CategoriesState {
  entities: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoriesState = { entities: [], loading: false, error: null };

export const CategoriesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    visible: computed(() => store.entities().filter((c) => !c.hidden)),
    sorted: computed(() =>
      [...store.entities()].sort((a, b) => a.name.localeCompare(b.name))
    ),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);
    const idService = inject(IdService);
    const appState = inject(AppStateStore);

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        let entities = await storage.getCategories();

        // Seed defaults on first launch
        if (entities.length === 0) {
          entities = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: idService.newId() }));
          for (const c of entities) {
            await storage.upsertCategory(c);
          }
        }

        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    async function add(c: Category) {
      await storage.upsertCategory(c);
      patchState(store, { entities: [...store.entities(), c] });
      appState.recordChange();
    }

    async function update(c: Category) {
      await storage.upsertCategory(c);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === c.id ? c : x)),
      });
      appState.recordChange();
    }

    async function remove(id: string) {
      await storage.deleteCategory(id);
      patchState(store, { entities: store.entities().filter((c) => c.id !== id) });
      appState.recordChange();
    }

    function getById(id: string): Category | undefined {
      return store.entities().find((c) => c.id === id);
    }

    return { load, add, update, remove, getById };
  })
);