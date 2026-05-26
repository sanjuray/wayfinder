import { computed, inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { PlacesStore } from './places.store';
import type { Place, PlaceStatus } from '../models';

/**
 * Session-only filter state. Not persisted — resets on page refresh.
 *
 * Architecture note: a "sidebar category click" is treated as a shortcut to
 * setting selectedCategoryIds to [that one id]. The popover's multi-select
 * writes to the same selectedCategoryIds. This way there's one source of
 * truth for category filtering instead of two competing flags.
 *
 * Extension hooks (selectedVibeIds, statuses, favoriteOnly) are stubbed but
 * not yet wired into UI — future-proofing the store shape.
 */
export interface FilterState {
  selectedCategoryIds: string[];
  selectedCollectionId: string | null;
  selectedLocality: string | null;
// Reserved for future expansion — declared but unused in v1
  selectedVibeIds: string[];
  selectedStatuses: PlaceStatus[];
  favoriteOnly: boolean;
}

const initialState: FilterState = {
  selectedCategoryIds: [],
  selectedCollectionId: null,
  selectedLocality: null,
  selectedVibeIds: [],
  selectedStatuses: [],
  favoriteOnly: false,
};

export const FilterStateStore = signalStore(
  { providedIn: 'root' },
  withState<FilterState>(initialState),
  withComputed((store) => {
    const places = inject(PlacesStore);
    return {
      /** True if any filter dimension is currently active. */
      anyFilterActive: computed(
        () =>
          store.selectedCategoryIds().length > 0 ||
          (store.selectedCollectionId() !== null && store.selectedCollectionId() !== undefined)||
          store.selectedLocality() !== null ||
          store.selectedVibeIds().length > 0 ||
          store.selectedStatuses().length > 0 ||
          store.favoriteOnly()
      ),
      /**
       * Apply all active filters with AND logic. If nothing is active,
       * returns all places.
       */
filteredPlaces: computed<Place[]>(() => {
        const all = places.entities();
        const catIds = store.selectedCategoryIds();
        const colId = store.selectedCollectionId();
        const loc = store.selectedLocality();
        const vibes = store.selectedVibeIds();
        const statuses = store.selectedStatuses();
        const favOnly = store.favoriteOnly();

        return all.filter((p) => {
          if (catIds.length > 0 && !catIds.includes(p.categoryId)) return false;
          if (colId && !p.collectionIds.includes(colId)) return false;
          if (loc && p.locality !== loc) return false;
          if (vibes.length > 0 && !p.vibeTagIds.some((v) => vibes.includes(v))) return false;
          if (statuses.length > 0 && !statuses.includes(p.status)) return false;
          if (favOnly && !p.isFavorite) return false;
          return true;
        });
      }),
/** Distinct localities across all saved places — feeds the locality dropdown. */
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
    /** Single-category toggle — used by sidebar clicks. */
    toggleSidebarCategory(categoryId: string): void {
      const current = store.selectedCategoryIds();
      if (current.length === 1 && current[0] === categoryId) {
        // Clicking the only active category clears the filter
        patchState(store, { selectedCategoryIds: [] });
      } else {
// Replace whatever was selected with just this one
        patchState(store, { selectedCategoryIds: [categoryId] });
      }
    },
    /** Multi-select toggle — used by the popover. */
    toggleCategoryInPopover(categoryId: string): void {
      const current = store.selectedCategoryIds();
      const next = current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId];
      patchState(store, { selectedCategoryIds: next });
    },
    /** Sidebar collection click: toggles filter to just that one collection. */
    toggleSidebarCollection(collectionId: string): void {
      const current = store.selectedCollectionId();
      if (current === collectionId) { 
        patchState(store, { selectedCollectionId: null });
       } else { 
        patchState(store, { selectedCollectionId: collectionId }); 
      } 
    },
    setLocality(locality: string | null): void {
      patchState(store, { selectedLocality: locality });
    },
    clearAll(): void {
      patchState(store, initialState);
    },
  }))
);
