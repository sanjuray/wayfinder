import {
  signalStore,
  withState,
  withMethods,
  withComputed,
  patchState,
} from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { IdService } from '../services/id.service';
import type { Trip } from '../models';

interface TripsState {
  entities: Trip[];
  /** True while a load is in flight. Reset to false on success or error. */
  loading: boolean;
  /**
   * True once load() has completed at least once. Consumers can use this
   * to distinguish "still booting" from "loaded, just empty / not found"
   * — important for the trip-plan facade which renders different states
   * for each.
   */
  hasLoaded: boolean;
  error: string | null;
}

const initialState: TripsState = {
  entities: [],
  loading: false,
  hasLoaded: false,
  error: null,
};

/**
 * Trips store. Mirrors the CollectionsStore surface (create / load / add /
 * updatePartial / remove / softDelete / getById) so callers can swap mental
 * models freely.
 *
 * `entities` excludes soft-deleted trips (deletedAt set). Computed sections
 * (inProgress / upcoming / drafts / past) filter further by date.
 */
export const TripsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const todayIso = () => new Date().toISOString().slice(0, 10);
    return {
      /**
       * Sorted-by-recent-update list. Drives the catch-all view if no
       * section grouping is wanted.
       */
      sorted: computed(() =>
        [...store.entities()].sort((a, b) =>
          b.updatedAt.localeCompare(a.updatedAt)
        )
      ),

      /**
       * Trips whose plannedDate is today. "In progress" is a slight stretch
       * (we don't track actual progress yet) but matches the mockup section
       * heading.
       */
      inProgress: computed(() =>
        store.entities().filter((t) => t.plannedDate?.startsWith(todayIso()))
      ),

      /** plannedDate strictly in the future, sorted nearest-first. */
      upcoming: computed(() =>
        store
          .entities()
          .filter((t) => t.plannedDate && t.plannedDate > todayIso())
          .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''))
      ),

      /** No plannedDate yet — the user created the trip but hasn't scheduled it. */
      drafts: computed(() =>
        store
          .entities()
          .filter((t) => !t.plannedDate && !t.isCompleted)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      ),

      /**
       * plannedDate in the past OR isCompleted. Trips that happened.
       * Sorted most-recent-first.
       */
      past: computed(() =>
        store
          .entities()
          .filter(
            (t) =>
              t.isCompleted ||
              (t.plannedDate !== undefined && t.plannedDate < todayIso())
          )
          .sort((a, b) =>
            (b.plannedDate ?? b.updatedAt).localeCompare(
              a.plannedDate ?? a.updatedAt
            )
          )
      ),
    };
  }),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);
    const idService = inject(IdService);

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        const entities = await storage.getTrips();
        // Defensive: filter out anything marked deleted in case the adapter
        // returned soft-deleted rows. (Matches CollectionsStore behavior;
        // adapters generally exclude these already, but belt-and-braces.)
        const live = entities.filter((t) => !t.deletedAt);
        patchState(store, {
          entities: live,
          loading: false,
          hasLoaded: true,
        });
      } catch (err) {
        patchState(store, {
          error: String(err),
          loading: false,
          hasLoaded: true,
        });
      }
    }

    /**
     * Creates a new draft trip. No plannedDate (it's a draft) — the user
     * sets that later from the trip-plan screen.
     */
    async function create(name: string): Promise<Trip> {
      const now = new Date().toISOString();
      const trip: Trip = {
        id: idService.newId(),
        name: name.trim(),
        stops: [],
        defaultTravelMode: 'auto',
        isCompleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await storage.upsertTrip(trip);
      patchState(store, { entities: [...store.entities(), trip] });
      return trip;
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

    async function updatePartial(
      id: string,
      partial: Partial<Trip>
    ): Promise<Trip | null> {
      const current = store.entities().find((t) => t.id === id);
      if (!current) return null;
      const updated: Trip = {
        ...current,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      await storage.upsertTrip(updated);
      patchState(store, {
        entities: store.entities().map((t) => (t.id === id ? updated : t)),
      });
      return updated;
    }

    async function remove(id: string) {
      await storage.deleteTrip(id);
      patchState(store, {
        entities: store.entities().filter((t) => t.id !== id),
      });
    }

    async function softDelete(id: string): Promise<void> {
      const current = store.entities().find((t) => t.id === id);
      if (!current) return;
      const now = new Date().toISOString();
      const deleted: Trip = { ...current, deletedAt: now, updatedAt: now };
      await storage.upsertTrip(deleted);
      patchState(store, {
        entities: store.entities().filter((t) => t.id !== id),
      });
    }

    function getById(id: string): Trip | undefined {
      return store.entities().find((t) => t.id === id);
    }

    return {
      load,
      create,
      add,
      update,
      updatePartial,
      remove,
      softDelete,
      getById,
    };
  })
);