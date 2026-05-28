import { Injectable, inject, signal, computed } from '@angular/core';
import { PlacesStore } from '../../../core/stores/places.store';
import { CategoriesStore } from '../../../core/stores/categories.store';
import { FilterStateStore } from '../../../core/stores/filter-state.store';
import type { Place, PlaceStatus } from '../../../core/models';

/**
 * Sort dimensions surfaced in the UI. Default is 'recent' (newest createdAt
 * first). 'lastVisited' uses the max visit.date across a place's visits;
 * places that have never been visited sort last in that mode.
 */
export type PlaceSort =
  | 'recent'
  | 'oldest'
  | 'name-az'
  | 'name-za'
  | 'last-visited'
  | 'category'
  | 'favorite';

/**
 * Per-route orchestrator service for the places list view. NOT providedIn:
 * 'root' — instantiated fresh per PlacesListComponent so the selection set
 * and sort state don't leak across navigations.
 *
 * Responsibilities:
 *   - own sort state
 *   - own bulk-selection state (a Set<placeId>)
 *   - derive `visiblePlaces` = FilterStateStore.filteredPlaces() sorted
 *   - expose bulk-action methods that fan out to PlacesStore.updatePartial /
 *     softDelete
 *
 * Reads filter state from FilterStateStore (single source of truth — see
 * ARCHITECTURE.md §filter pipeline). Never duplicates filter logic.
 */
@Injectable()
export class PlacesListFacade {
  private placesStore = inject(PlacesStore);
  private categoriesStore = inject(CategoriesStore);
  private filterStore = inject(FilterStateStore);

  /** Currently chosen sort. Default 'recent'. Not persisted in v1. */
  readonly sort = signal<PlaceSort>('recent');

  /**
   * Bulk-select mode. Toggles checkbox visibility and the action bar.
   * Activated by long-press / right-click on a row (see component).
   */
  readonly selectMode = signal(false);

  /** Set of selected place ids. Internal — components read `selectedIds()`. */
  private readonly _selected = signal<ReadonlySet<string>>(new Set());

  readonly selectedIds = computed<ReadonlySet<string>>(() => this._selected());
  readonly selectedCount = computed(() => this._selected().size);

  /**
   * Visible places = filter store's filteredPlaces, then sorted by current
   * sort dimension. This is the array the template renders.
   */
  readonly visiblePlaces = computed<Place[]>(() => {
    const arr = [...this.filterStore.filteredPlaces()];
    return this.sortPlaces(arr, this.sort());
  });

  /**
   * How many selected places are currently hidden by active filters. Drives
   * the "X selected (Y hidden by filter)" hint. A selected place can be
   * hidden if the user changed filters after selecting.
   */
  readonly hiddenSelectedCount = computed(() => {
    const visibleIds = new Set(this.visiblePlaces().map((p) => p.id));
    let hidden = 0;
    this._selected().forEach((id) => {
      if (!visibleIds.has(id)) hidden++;
    });
    return hidden;
  });

  // ------ Selection ------

  enterSelectMode(initialId?: string): void {
    this.selectMode.set(true);
    if (initialId) this.toggle(initialId);
  }

  exitSelectMode(): void {
    this.selectMode.set(false);
    this._selected.set(new Set());
  }

  toggle(id: string): void {
    this._selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this._selected().has(id);
  }

  /**
   * Select / deselect every currently-visible place. "Select all" header
   * checkbox semantics. Does NOT touch places hidden by filter.
   */
  toggleSelectAllVisible(): void {
    const visible = this.visiblePlaces();
    const allSelected = visible.every((p) => this._selected().has(p.id));
    this._selected.update((set) => {
      const next = new Set(set);
      if (allSelected) {
        visible.forEach((p) => next.delete(p.id));
      } else {
        visible.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }

  /** Whether every currently-visible row is selected. */
  readonly allVisibleSelected = computed(() => {
    const visible = this.visiblePlaces();
    if (visible.length === 0) return false;
    const sel = this._selected();
    return visible.every((p) => sel.has(p.id));
  });

  // ------ Sort ------

  setSort(s: PlaceSort): void {
    this.sort.set(s);
  }

  private sortPlaces(arr: Place[], sort: PlaceSort): Place[] {
    switch (sort) {
      case 'recent':
        return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'oldest':
        return arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case 'name-az':
        return arr.sort((a, b) =>
          (a.customName ?? a.name).localeCompare(b.customName ?? b.name)
        );
      case 'name-za':
        return arr.sort((a, b) =>
          (b.customName ?? b.name).localeCompare(a.customName ?? a.name)
        );
      case 'last-visited': {
        // Places without visits sort last. Among visited, most recent first.
        return arr.sort((a, b) => {
          const av = lastVisitDate(a);
          const bv = lastVisitDate(b);
          if (av === bv) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return bv.localeCompare(av);
        });
      }
      case 'category': {
        // Sort by category display name, with secondary sort by place name.
        const catName = (id: string) =>
          this.categoriesStore.getById(id)?.name ?? '~~';
        return arr.sort((a, b) => {
          const c = catName(a.categoryId).localeCompare(catName(b.categoryId));
          if (c !== 0) return c;
          return (a.customName ?? a.name).localeCompare(b.customName ?? b.name);
        });
      }
      case 'favorite':
        // Favorites first, then most recent within each group.
        return arr.sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          return b.createdAt.localeCompare(a.createdAt);
        });
    }
  }

  // ------ Bulk actions ------

  /** Set status on every selected place. */
  async bulkSetStatus(status: PlaceStatus): Promise<void> {
    const ids = Array.from(this._selected());
    await Promise.all(
      ids.map((id) => this.placesStore.updatePartial(id, { status }))
    );
  }

  /** Set favorite flag on every selected place. */
  async bulkSetFavorite(isFavorite: boolean): Promise<void> {
    const ids = Array.from(this._selected());
    await Promise.all(
      ids.map((id) => this.placesStore.updatePartial(id, { isFavorite }))
    );
  }

  /**
   * Add every selected place to the given collection ids (additive — existing
   * memberships preserved). Reads each place's current collectionIds to avoid
   * a clobber.
   */
  async bulkAddToCollections(collectionIds: string[]): Promise<void> {
    if (collectionIds.length === 0) return;
    const ids = Array.from(this._selected());
    await Promise.all(
      ids.map(async (id) => {
        const place = this.placesStore.getById(id);
        if (!place) return;
        const merged = Array.from(
          new Set([...place.collectionIds, ...collectionIds])
        );
        await this.placesStore.updatePartial(id, { collectionIds: merged });
      })
    );
  }

  /** Soft-delete every selected place, then exit select mode. */
  async bulkSoftDelete(): Promise<void> {
    const ids = Array.from(this._selected());
    await Promise.all(ids.map((id) => this.placesStore.softDelete(id)));
    this.exitSelectMode();
  }
}

/**
 * Most recent visit.date across a place's visits, or null if none. Pure
 * helper — not a method on the facade because it's referenced from the
 * sort comparator and doesn't read any signal state.
 */
function lastVisitDate(p: Place): string | null {
  if (!p.visits || p.visits.length === 0) return null;
  let max: string | null = null;
  for (const v of p.visits) {
    if (!v.date) continue;
    if (max === null || v.date > max) max = v.date;
  }
  return max;
}