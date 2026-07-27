import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { PlacesStore } from './places.store';
import { isWithinBounds, type MapBounds } from '../utils/geo';
import type { Place, PlaceStatus } from '../models';
 
/**
 * Session-only filter state for the /map page. Not persisted — resets on refresh.
 *
 * Multi-select everywhere: categories, collections, vibes, statuses.
 * Sidebar clicks are convenience shortcuts that write into the same
 * state as the popover's full multi-select — one source of truth.
 */
export interface FilterState {
  selectedCategoryIds: string[];
  selectedCollectionIds: string[];   // Phase 9 upgrade: was single selectedCollectionId
  selectedVibeIds: string[];
  selectedLocality: string | null;
  selectedStatuses: PlaceStatus[];
  favoriteOnly: boolean;

  /**
   * Current map viewport, or null before the first moveend fires.
   *
   * This is a *filter dimension*, not a separate data source: filteredPlaces
   * narrows the loaded places down to what's inside these bounds so Leaflet
   * only ever renders on-screen markers. That's the whole v1 scaling win —
   * tens of thousands of places in IndexedDB, but only the visible handful
   * become Leaflet markers.
   *
   * null = "no viewport constraint yet" and means every place passes the
   * bounds check, so the map behaves exactly as before on first paint and
   * for any code path that never sets bounds (tests, list views).
   *
   * In v2 these same bounds are forwarded to a /places/viewport API call so
   * out-of-view places aren't even fetched. The filter shape is identical;
   * only who applies it moves from the client to the server.
   */
  viewportBounds: MapBounds | null;
}

const initialState: FilterState = {
  selectedCategoryIds: [],
  selectedCollectionIds: [],
  selectedVibeIds: [],
  selectedLocality: null,
  selectedStatuses: [],
  favoriteOnly: false,
  viewportBounds: null,
};
 
export const FilterStateStore = signalStore(
  { providedIn: 'root' },
  withState<FilterState>(initialState),
  withComputed((store) => {
    const places = inject(PlacesStore);
    return {
      anyFilterActive: computed(
        () =>
          store.selectedCategoryIds().length > 0 ||
          store.selectedCollectionIds().length > 0 ||
          store.selectedVibeIds().length > 0 ||
          store.selectedLocality() !== null ||
          store.selectedStatuses().length > 0 ||
          store.favoriteOnly()
      ),

      /**
       * Places passing every active attribute filter — but NOT the viewport
       * bounds. This is what the sidebar counts, the empty-state logic, and
       * anything that reasons about "how many places match the user's filters
       * regardless of where the map happens to be looking" should read.
       *
       * Keeping viewport out of this is deliberate: a category with 40 places
       * shouldn't show "3" just because the map is zoomed into one street.
       */
      filteredPlaces: computed<Place[]>(() => {
        const all = places.entities();
        const catIds = store.selectedCategoryIds();
        const colIds = store.selectedCollectionIds();
        const vibes = store.selectedVibeIds();
        const loc = store.selectedLocality();
        const statuses = store.selectedStatuses();
        const favOnly = store.favoriteOnly();

        return all.filter((p) => {
          if (catIds.length > 0 && !catIds.includes(p.categoryId)) return false;
          if (colIds.length > 0 && !colIds.some((id) => p.collectionIds.includes(id))) return false;
          if (vibes.length > 0 && !vibes.some((v) => p.vibeTagIds?.includes(v))) return false;
          if (loc && p.locality !== loc) return false;
          if (statuses.length > 0 && !statuses.includes(p.status)) return false;
          if (favOnly && !p.isFavorite) return false;
          return true;
        });
      }),
 
      /**
       * filteredPlaces further narrowed to the current viewport. This is the
       * list the MAP renders — Leaflet only gets markers that are on screen.
       *
       * When viewportBounds is null (before first moveend), this equals
       * filteredPlaces, so nothing breaks on first paint.
       */
      visiblePlaces: computed<Place[]>(() => {
        const bounds = store.viewportBounds();
        const all = places.entities();
        const catIds = store.selectedCategoryIds();
        const colIds = store.selectedCollectionIds();
        const vibes = store.selectedVibeIds();
        const loc = store.selectedLocality();
        const statuses = store.selectedStatuses();
        const favOnly = store.favoriteOnly();
 
        return all.filter((p) => {
          if (catIds.length > 0 && !catIds.includes(p.categoryId)) return false;
          if (colIds.length > 0 && !colIds.some((id) => p.collectionIds.includes(id))) return false;
          if (vibes.length > 0 && !vibes.some((v) => p.vibeTagIds?.includes(v))) return false;
          if (loc && p.locality !== loc) return false;
          if (statuses.length > 0 && !statuses.includes(p.status)) return false;
          if (favOnly && !p.isFavorite) return false;
          if (bounds && !isWithinBounds(p, bounds)) return false;
          return true;
        });
      }),
 
      availableLocalities: computed(() => {
        const localities = new Set<string>();
        for (const p of places.entities()) {
          if (p.locality) localities.add(p.locality);
        }
        return Array.from(localities).sort();
      }),
    };
  }),
  withMethods((store) => ({
    // ---- Category ----
 
    /** Sidebar click: toggle a single category. Clicking the only active one clears. */
    toggleSidebarCategory(categoryId: string): void {
      const current = store.selectedCategoryIds();
      if (current.length === 1 && current[0] === categoryId) {
        patchState(store, { selectedCategoryIds: [] });
      } else if (current.includes(categoryId)) {
        patchState(store, { selectedCategoryIds: current.filter((id) => id !== categoryId) });
      } else {
        // Sidebar single-click replaces the selection with just this one
        patchState(store, { selectedCategoryIds: [categoryId] });
      }
    },
 
    /** Popover multi-select toggle. */
    toggleCategoryInPopover(categoryId: string): void {
      const current = store.selectedCategoryIds();
      patchState(store, {
        selectedCategoryIds: current.includes(categoryId)
          ? current.filter((id) => id !== categoryId)
          : [...current, categoryId],
      });
    },
 
    // ---- Collection —-

    /** Sidebar click: toggle a single collection (same UX as categories). */
    toggleSidebarCollection(collectionId: string): void {
      const current = store.selectedCollectionIds();
      if (current.length === 1 && current[0] === collectionId) {
        patchState(store, { selectedCollectionIds: [] });
      } else if (current.includes(collectionId)) {
        patchState(store, { selectedCollectionIds: current.filter((id) => id !== collectionId) });
      } else {
        patchState(store, { selectedCollectionIds: [collectionId] });
      }
    },
 
    /** Popover multi-select toggle. */
    toggleCollectionInPopover(collectionId: string): void {
      const current = store.selectedCollectionIds();
      patchState(store, {
        selectedCollectionIds: current.includes(collectionId)
          ? current.filter((id) => id !== collectionId)
          : [...current, collectionId],
      });
    },
 
    // ---- Vibe ----
 
    toggleVibeInPopover(vibeId: string): void {
      const current = store.selectedVibeIds();
      patchState(store, {
        selectedVibeIds: current.includes(vibeId)
          ? current.filter((id) => id !== vibeId)
          : [...current, vibeId],
      });
    },
 
    /** Sidebar vibe chip click: toggle. */
    toggleSidebarVibe(vibeId: string): void {
      const current = store.selectedVibeIds();
      if (current.length === 1 && current[0] === vibeId) {
        patchState(store, { selectedVibeIds: [] });
      } else if (current.includes(vibeId)) {
        patchState(store, { selectedVibeIds: current.filter((id) => id !== vibeId) });
      } else {
        patchState(store, { selectedVibeIds: [vibeId] });
      }
    },
 
    // ---- Viewport ----
 
    /**
     * Called by the map on moveend (pan/zoom settle). Sets the bounds that
     * visiblePlaces filters by. Pad the bounds slightly before passing them
     * in (see padBounds) so edge markers are ready before they scroll in.
     *
     * Cheap to call on every moveend: it's a single signal write, and the
     * visiblePlaces recompute is a linear scan the UI already does.
     */
    setViewportBounds(bounds: MapBounds): void {
      patchState(store, { viewportBounds: bounds });
    },
 
    // ---- Misc ----
 
    // ---- Bulk setters (used by the filter popover's multi-select components) ----
 
    setSelectedCategoryIds(ids: string[]): void {
      patchState(store, { selectedCategoryIds: ids });
    },
    setSelectedVibeIds(ids: string[]): void {
      patchState(store, { selectedVibeIds: ids });
    },
    setSelectedCollectionIds(ids: string[]): void {
      patchState(store, { selectedCollectionIds: ids });
    },
 
    setLocality(locality: string | null): void {
      patchState(store, { selectedLocality: locality });
    },
 
    clearAll(): void {
      // Preserve the viewport — clearing filters shouldn't reset where the
      // map is looking. Only the attribute filters reset.
      patchState(store, { ...initialState, viewportBounds: store.viewportBounds() });
    },
  }))
);