import { Injectable, inject, signal, computed } from '@angular/core';
import { TripsStore } from '../../core/stores/trips.store';
import { PlacesStore } from '../../core/stores/places.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { IdService } from '../../core/services/id.service';
import type { Trip, TripStop, Place, TravelMode } from '../../core/models';

/**
 * Per-route orchestrator for the trip-plan screen. NOT providedIn 'root' —
 * instantiated fresh per TripPlanComponent so the editing state is isolated
 * per visit.
 *
 * Responsibilities:
 *   - load the trip by id (called from the component's ngOnInit)
 *   - own draft edits to name / plannedDate / notes (autosaved on blur)
 *   - own the stops array (add / remove / reorder / per-stop note)
 *   - expose `stopsWithPlace` — stops zipped with their resolved Place
 *   - autosave to TripsStore (debounced via patches)
 *
 * Source of truth: stops array order IS the order. No orderIndex field
 * (removed from the model in Phase 6a).
 */
@Injectable()
export class TripPlanFacade {
  private tripsStore = inject(TripsStore);
  private placesStore = inject(PlacesStore);
  private categoriesStore = inject(CategoriesStore);
  private idService = inject(IdService);

  // ---- Identity / load state ----

  /** The id passed in via the route param. Set once via load(). */
  readonly tripId = signal<string | null>(null);

  // ---- Undo state for stop removal (Phase 6d) ----

  /**
   * Stash for the most-recently-removed stop, used to power the undo toast
   * and the fading ghost-pin on the map. Null when no removal is pending
   * undo.
   *
   * Why store the full stop + original index: restoring needs to splice
   * back at the exact position, not just append.
   */
  readonly pendingUndoStop = signal<UndoStopStash | null>(null);

  /** Timer that auto-dismisses the undo after UNDO_TIMEOUT_MS. */
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * How long the undo toast (and the ghost pin) live before auto-dismissing.
   * Longer than the typical collection-detail undo (6s) because the trip
   * planner has more competing UI — the user might be filtering, scrolling
   * the stop list, or rearranging when they realize their mistake.
   */
  private readonly UNDO_TIMEOUT_MS = 30_000;

  /**
   * Loaded trip, resolved reactively from the store. Updates automatically
   * when the store changes — important during initial app boot when the
   * trips store loads asynchronously, AFTER the planner has already mounted.
   * If we set this once at component init via tripsStore.getById(), we'd
   * race the store load and render the "not found" state even for valid
   * trip ids.
   */
  readonly trip = computed<Trip | null>(() => {
    const id = this.tripId();
    if (!id) return null;
    return this.tripsStore.getById(id) ?? null;
  });

  /**
   * True once the trips store has finished its initial load AND a trip id
   * has been set. Differentiates "still loading the store" from "store
   * loaded, trip not found." The component uses this to gate the loading
   * vs missing vs planner states.
   *
   * We check `hasLoaded` rather than `!loading` because there's a brief
   * window during app bootstrap where `loading` is still false (initial
   * state) and the planner could be instantiated before app.ts's ngOnInit
   * calls trips.load(). `hasLoaded` flips true only after a load completes,
   * which is what we actually want.
   */
  readonly loaded = computed<boolean>(() => {
    return this.tripId() !== null && this.tripsStore.hasLoaded();
  });

  // ---- Derived: stops + their places ----

  /**
   * Stops with their resolved Place objects. If a place was deleted but is
   * still referenced by a stop, `place` is null — the stop card still renders
   * with a "place no longer available" label so the user can remove it.
   */
  readonly stopsWithPlace = computed<
    Array<{ stop: TripStop; place: Place | null }>
  >(() => {
    const t = this.trip();
    if (!t) return [];
    return t.stops.map((stop) => ({
      stop,
      place: this.placesStore.getById(stop.placeId) ?? null,
    }));
  });

  /** Coordinates for polyline rendering. Filters out stops whose place is gone. */
  readonly stopCoordinates = computed<Array<[number, number]>>(() => {
    return this.stopsWithPlace()
      .filter((s): s is { stop: TripStop; place: Place } => s.place !== null)
      .map(({ place }) => [place.lat, place.lng]);
  });

  /** Places NOT currently in the trip — drives the sidebar picker. */
  readonly availablePlaces = computed<Place[]>(() => {
    const t = this.trip();
    if (!t) return [];
    const stopIds = new Set(t.stops.map((s) => s.placeId));
    return this.placesStore
      .entities()
      .filter((p) => !stopIds.has(p.id))
      .sort((a, b) =>
        (a.customName ?? a.name).localeCompare(b.customName ?? b.name)
      );
  });

  // ---- Load ----

  /**
   * Set the trip id. The `trip` computed resolves it from the store
   * reactively — so this is safe to call before the store has finished
   * loading. The component's effect that depends on `trip()` will re-run
   * once the store finishes its initial load.
   */
  load(id: string): void {
    this.tripId.set(id);
  }

  // ---- Metadata edits ----

  async setName(name: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.updatePartial(t.id, { name: name.trim() });
  }

  /**
   * Update plannedDate. Pass undefined / empty to clear it (turns trip back
   * into a draft).
   */
  async setPlannedDate(iso: string | undefined): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.updatePartial(t.id, {
      plannedDate: iso || undefined,
    });
  }

  async setNotes(notes: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.updatePartial(t.id, { notes });
  }

  async setTravelMode(mode: TravelMode): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.updatePartial(t.id, {
      defaultTravelMode: mode,
    });
  }

  async setIsCompleted(value: boolean): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.updatePartial(t.id, {
      isCompleted: value,
    });
  }

  // ---- Stops: add / remove / reorder / note ----

  /**
   * Append a place to the stops list (if not already present). No-op when
   * the place is already a stop (map clicks could double-fire).
   */
  async addStop(placeId: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    if (t.stops.some((s) => s.placeId === placeId)) return;
    const newStop: TripStop = {
      id: this.idService.newId(),
      placeId,
      visitedDuringTrip: false,
    };
    const stops = [...t.stops, newStop];
    await this.persistStops(stops);
  }

  /**
   * Remove a stop by stop id (not place id). Sets up an undo stash so the
   * component can show a toast + fading ghost pin for UNDO_TIMEOUT_MS,
   * after which the removal is finalized.
   *
   * If a previous undo is still pending, it's committed (timer cleared,
   * stash dropped) before stashing the new one — only one undo lives at a
   * time. The previous stop's removal becomes permanent at that moment.
   */
  async removeStop(stopId: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const index = t.stops.findIndex((s) => s.id === stopId);
    if (index < 0) return;
    const stop = t.stops[index];

    // Capture snapshot for the ghost-pin marker — place may be deleted
    // between remove and undo (edge case), but the coords stay valid.
    const place = this.placesStore.getById(stop.placeId);

    // Commit any prior undo first
    this.clearUndoTimer();

    const stops = t.stops.filter((s) => s.id !== stopId);
    await this.persistStops(stops);

    this.pendingUndoStop.set({
      stop,
      index,
      placeName: place?.customName ?? place?.name ?? 'this stop',
      lat: place?.lat ?? null,
      lng: place?.lng ?? null,
      expiresAt: Date.now() + this.UNDO_TIMEOUT_MS,
    });

    this.undoTimer = setTimeout(() => {
      this.pendingUndoStop.set(null);
      this.undoTimer = null;
    }, this.UNDO_TIMEOUT_MS);
  }

  /**
   * Restore the most-recently-removed stop at its original position. No-op
   * if no undo is pending. If another stop has been added since (so the
   * original index is now out of bounds), the stop is appended instead.
   */
  async undoRemoveStop(): Promise<void> {
    const stash = this.pendingUndoStop();
    if (!stash) return;

    this.clearUndoTimer();
    this.pendingUndoStop.set(null);

    const t = this.trip();
    if (!t) return;

    // Avoid double-restore if the same stop has somehow already returned
    if (t.stops.some((s) => s.id === stash.stop.id)) return;

    const stops = [...t.stops];
    const insertAt = Math.min(stash.index, stops.length);
    stops.splice(insertAt, 0, stash.stop);
    await this.persistStops(stops);
  }

  /** Manually dismiss the undo (user clicked X on the toast). */
  dismissUndo(): void {
    this.clearUndoTimer();
    this.pendingUndoStop.set(null);
  }

  private clearUndoTimer(): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  }

  /**
   * Move a stop from `fromIndex` to `toIndex`. Mirrors CDK's
   * moveItemInArray semantics (both indices are positions in the resulting
   * array, not "before / after" markers).
   */
  async moveStop(fromIndex: number, toIndex: number): Promise<void> {
    const t = this.trip();
    if (!t) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= t.stops.length) return;
    if (toIndex < 0 || toIndex >= t.stops.length) return;
    const stops = [...t.stops];
    const [moved] = stops.splice(fromIndex, 1);
    stops.splice(toIndex, 0, moved);
    await this.persistStops(stops);
  }

  /** Convenience: move a stop up by 1 position (no-op if already first). */
  async moveStopUp(stopId: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const i = t.stops.findIndex((s) => s.id === stopId);
    if (i <= 0) return;
    await this.moveStop(i, i - 1);
  }

  /** Convenience: move a stop down by 1 position. */
  async moveStopDown(stopId: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const i = t.stops.findIndex((s) => s.id === stopId);
    if (i === -1 || i >= t.stops.length - 1) return;
    await this.moveStop(i, i + 1);
  }

  async setStopNote(stopId: string, note: string): Promise<void> {
    const t = this.trip();
    if (!t) return;
    const stops = t.stops.map((s) =>
      s.id === stopId
        ? { ...s, perStopNote: note.trim() || undefined }
        : s
    );
    await this.persistStops(stops);
  }

  // ---- Delete ----

  /**
   * Soft-delete the whole trip. The `trip` computed becomes null
   * automatically once tripsStore.softDelete removes it from entities.
   * Caller (the component) is responsible for confirming and for
   * navigating away after this resolves.
   */
  async deleteTrip(): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.softDelete(t.id);
  }

  // ---- Persistence helper ----

  private async persistStops(stops: TripStop[]): Promise<void> {
    const t = this.trip();
    if (!t) return;
    await this.tripsStore.updatePartial(t.id, { stops });
  }
}

/**
 * Snapshot stashed when a stop is removed. Lives in the facade's
 * `pendingUndoStop` signal for UNDO_TIMEOUT_MS, then is dropped.
 *
 * `lat` / `lng` are stored so the component can render a fading ghost-pin
 * on the map even if the underlying Place is deleted between remove and
 * undo (edge case, but the coords stay valid regardless).
 *
 * `expiresAt` is exposed for the component's countdown UI (toast can show
 * how long is left, ghost pin can fade as a function of remaining time).
 */
export interface UndoStopStash {
  stop: TripStop;
  /** Original index in the stops array. Used to restore at the same spot. */
  index: number;
  placeName: string;
  lat: number | null;
  lng: number | null;
  /** Wall-clock timestamp when the undo auto-dismisses. */
  expiresAt: number;
}