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
import { AppStateStore } from './app-state.store';
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
       * Trips that are actively underway: explicitly started (startedAt
       * is set) and not yet finished. Replaces the pre-Phase-7 "plannedDate
       * is today" heuristic, which lied when a trip started a day late.
       *
       * Sorted by startedAt descending — most recently started first.
       */
      inProgress: computed(() =>
        store
          .entities()
          .filter((t) => t.startedAt && !t.isCompleted)
          .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))
      ),

      /**
       * Trips scheduled for today or later, not yet started or completed.
       * Sorted nearest-first.
       *
       * "Today, not started" lives here (not in inProgress) — they're still
       * pending until the user opens them and either starts the trip or
       * marks a stop visited.
       */
      upcoming: computed(() =>
        store
          .entities()
          .filter(
            (t) =>
              !t.isCompleted &&
              !t.startedAt &&
              t.plannedDate !== undefined &&
              t.plannedDate >= todayIso()
          )
          .sort((a, b) => (a.plannedDate ?? '').localeCompare(b.plannedDate ?? ''))
      ),

      /** No plannedDate, not started, not completed — user created but hasn't scheduled or started. */
      drafts: computed(() =>
        store
          .entities()
          .filter((t) => !t.plannedDate && !t.startedAt && !t.isCompleted)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      ),

      /**
       * Completed trips, OR trips with a plannedDate in the past that
       * were never started (so they're effectively abandoned schedules).
       *
       * Does NOT include started-but-not-completed trips, even if their
       * plannedDate is past — those stay in inProgress until the user
       * finishes them. A multi-day trip in progress shouldn't fall into
       * Past automatically.
       *
       * Sorted most-recent-first.
       */
      past: computed(() =>
        store
          .entities()
          .filter(
            (t) =>
              t.isCompleted ||
              (!t.startedAt &&
                t.plannedDate !== undefined &&
                t.plannedDate < todayIso())
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
    const appState = inject(AppStateStore);

    /**
     * Normalize a trip name for case-insensitive comparison: trim, then
     * lowercase. Empty strings remain empty (caller's problem — names
     * must be non-empty by separate validation).
     */
    function normalizeName(name: string): string {
      return name.trim().toLowerCase();
    }

    /**
     * Returns true iff `candidate` doesn't collide with any non-deleted
     * trip's name (case-insensitive comparison after trimming).
     * `ignoreId` excludes that trip from the comparison — pass the trip
     * being renamed so its current name doesn't count as a collision
     * with itself. Empty candidate strings are treated as unavailable
     * (separate validation should prevent them ever reaching here).
     */
    function nameAvailable(candidate: string, ignoreId?: string): boolean {
      const target = normalizeName(candidate);
      if (!target) return false;
      return !store.entities().some(
        (t) =>
          t.id !== ignoreId &&
          !t.deletedAt &&
          normalizeName(t.name) === target
      );
    }

    /**
     * Find a unique name based on `desired`, appending " (copy)",
     * " (copy 2)", ... until no collision. Used by the duplicate-trip
     * flow when a previous duplicate already used the obvious name.
     */
    function findUniqueName(desired: string): string {
      const trimmed = desired.trim();
      if (nameAvailable(trimmed)) return trimmed;
      // Try with " (copy)" first, then " (copy N)"
      const withCopy = `${trimmed} (copy)`;
      if (nameAvailable(withCopy)) return withCopy;
      for (let n = 2; n < 1000; n++) {
        const candidate = `${trimmed} (copy ${n})`;
        if (nameAvailable(candidate)) return candidate;
      }
      // Pathological fallback — append a short random suffix
      return `${trimmed} (copy ${idService.newId().slice(0, 6)})`;
    }

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        const entities = await storage.getTrips();
        // Defensive: filter out anything marked deleted in case the adapter
        // returned soft-deleted rows. (Matches CollectionsStore behavior;
        // adapters generally exclude these already, but belt-and-braces.)
        // Migration: pre-Phase-7-followup trips may have defaultTravelMode
        // = 'cycling', which no longer exists. Map to 'auto' so the user
        // re-picks consciously (motorcycle is a meaningfully different
        // mode from a bicycle, so we don't presume).
        const live = entities
          .filter((t) => !t.deletedAt)
          .map((t) => {
            if ((t.defaultTravelMode as string) === 'cycling') {
              return { ...t, defaultTravelMode: 'auto' as const };
            }
            return t;
          });
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
     *
     * Throws `Error("DUPLICATE_TRIP_NAME")` if the name is empty or
     * collides with an existing trip's name (case-insensitive,
     * non-deleted trips only). Callers should pre-check via
     * `nameAvailable()` and surface a friendly error in the UI; the
     * throw is the safety net.
     */
    async function create(name: string): Promise<Trip> {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('DUPLICATE_TRIP_NAME');
      if (!nameAvailable(trimmed)) {
        throw new Error('DUPLICATE_TRIP_NAME');
      }
      const now = new Date().toISOString();
      const trip: Trip = {
        id: idService.newId(),
        name: trimmed,
        stops: [],
        defaultTravelMode: 'auto',
        isCompleted: false,
        createdAt: now,
        updatedAt: now,
      };
      await storage.upsertTrip(trip);
      patchState(store, { entities: [...store.entities(), trip] });
      appState.recordChange();
      return trip;
    }

    async function add(t: Trip) {
      await storage.upsertTrip(t);
      patchState(store, { entities: [...store.entities(), t] });
      appState.recordChange();
    }

    async function update(t: Trip) {
      const updated = { ...t, updatedAt: new Date().toISOString() };
      await storage.upsertTrip(updated);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === t.id ? updated : x)),
      });
      appState.recordChange();
    }

    async function updatePartial(
      id: string,
      partial: Partial<Trip>
    ): Promise<Trip | null> {
      const current = store.entities().find((t) => t.id === id);
      if (!current) return null;
      // If the caller is changing the name, validate uniqueness.
      if (partial.name !== undefined) {
        const trimmed = partial.name.trim();
        if (!trimmed) throw new Error('DUPLICATE_TRIP_NAME');
        if (!nameAvailable(trimmed, id)) {
          throw new Error('DUPLICATE_TRIP_NAME');
        }
        partial = { ...partial, name: trimmed };
      }
      const updated: Trip = {
        ...current,
        ...partial,
        updatedAt: new Date().toISOString(),
      };
      await storage.upsertTrip(updated);
      patchState(store, {
        entities: store.entities().map((t) => (t.id === id ? updated : t)),
      });
      appState.recordChange();
      return updated;
    }

    async function remove(id: string) {
      await storage.deleteTrip(id);
      patchState(store, {
        entities: store.entities().filter((t) => t.id !== id),
      });
      appState.recordChange();
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
      appState.recordChange();
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
      nameAvailable,
      findUniqueName,
    };
  })
);