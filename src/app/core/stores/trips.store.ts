import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import type { Trip } from '../models';

interface TripsState {
  entities: Trip[];
  loading: boolean;
  error: string | null;
}

const initialState: TripsState = { entities: [], loading: false, error: null };

export const TripsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const today = () => new Date().toISOString().slice(0, 10);
    return {
      inProgress: computed(() =>
        store.entities().filter((t) => t.plannedDate?.startsWith(today()))
      ),
      upcoming: computed(() =>
        store
          .entities()
          .filter((t) => t.plannedDate && t.plannedDate > today())
          .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''))
      ),
      drafts: computed(() => store.entities().filter((t) => !t.plannedDate)),
      past: computed(() =>
        store.entities().filter((t) => t.plannedDate && t.plannedDate < today())
      ),
    };
  }),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        const entities = await storage.getTrips();
        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    async function add(t: Trip) {
      await storage.upsertTrip(t);
      patchState(store, { entities: [...store.entities(), t] });
    }

    async function update(t: Trip) {
      const updated = { ...t, updatedAt: new Date().toISOString() };
      await storage.upsertTrip(updated);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === t.id ? updated : x)),
      });
    }

    async function remove(id: string) {
      await storage.deleteTrip(id);
      patchState(store, { entities: store.entities().filter((t) => t.id !== id) });
    }

    function getById(id: string): Trip | undefined {
      return store.entities().find((t) => t.id === id);
    }

    return { load, add, update, remove, getById };
  })
);