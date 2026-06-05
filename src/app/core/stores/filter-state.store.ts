import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { PlacesStore } from './places.store';
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
}

const initialState: FilterState = {
  selectedCategoryIds: [],
  selectedCollectionIds: [],
  selectedVibeIds: [],
  selectedLocality: null,
  selectedStatuses: [],
  favoriteOnly: false,
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

    // ---- Collection ----

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
      patchState(store, initialState);
    },
  }))
);