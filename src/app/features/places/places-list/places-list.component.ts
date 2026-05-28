import {
  Component,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { PlacesStore } from '../../../core/stores/places.store';
import { CategoriesStore } from '../../../core/stores/categories.store';
import { CollectionsStore } from '../../../core/stores/collections.store';
import { VibeTagsStore } from '../../../core/stores/vibe-tags.store';
import { FilterStateStore } from '../../../core/stores/filter-state.store';

import { FilterPopoverComponent } from '../../home/filter-popover.component';
import { PlaceDetailComponent } from '../place-detail/place-detail.component';
import { DeleteConfirmComponent } from '../place-detail/delete-confirm.component';
import { CollectionPickerComponent } from '../../../shared/collection-picker/collection-picker.component';

import { PlacesListFacade, PlaceSort } from './places-list.facade';
import type { Place, Category } from '../../../core/models';

const LONG_PRESS_MS = 500;

/**
 * Places list view at /places. Renders every saved place as a card row,
 * sortable + filterable, with bulk actions behind a long-press / right-click
 * gesture.
 *
 * Visual language mirrors the .place row pattern in collection-detail —
 * rotated-diamond category icon + name + status badge + vibe tags + favorite
 * star. The classes are locally re-defined (per the architecture rule:
 * features never import from features), but the look is intentionally the
 * same so the app feels cohesive.
 *
 * Volume note: this currently renders every visible place with a plain @for.
 * For most users this is fine indefinitely. If volume becomes a real problem
 * (200+ places sustained), the rendering hook below is the place to drop in
 * cdk-virtual-scroll-viewport — the facade's `visiblePlaces` is already a
 * sliced/sorted signal so the change would be local to the template.
 */
@Component({
  selector: 'wf-places-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PlacesListFacade],
  imports: [
    FormsModule,
    RouterLink,
    FilterPopoverComponent,
    PlaceDetailComponent,
    DeleteConfirmComponent,
    CollectionPickerComponent,
  ],
  templateUrl: './places-list.component.html',
  styleUrls: ['./places-list.component.css'],
})
export class PlacesListComponent {
  protected facade = inject(PlacesListFacade);
  protected placesStore = inject(PlacesStore);
  protected categoriesStore = inject(CategoriesStore);
  protected collectionsStore = inject(CollectionsStore);
  protected vibeTagsStore = inject(VibeTagsStore);
  protected filterStore = inject(FilterStateStore);
  private router = inject(Router);

  @ViewChild(PlaceDetailComponent) protected placeDetail?: PlaceDetailComponent;

  /** Filter popover open/closed. */
  protected showFilters = signal(false);

  /** Sort menu open/closed. */
  protected showSortMenu = signal(false);

  /** Bulk-delete confirm modal open/closed. */
  protected showBulkDelete = signal(false);

  /** Collection picker modal open/closed. */
  protected showCollectionPicker = signal(false);

  /** Long-press timer handle. Cleared on pointerup / pointermove. */
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * True from the moment a long-press fires until the next pointerup. We use
   * this to swallow the click event that the browser fires after the
   * pointerup, which would otherwise toggle the just-selected row.
   */
  private suppressNextClick = false;

  /**
   * Lookup index for category by id. Recomputed only when the categories
   * store changes — cheap, but a Map saves an O(n) find per row.
   */
  protected categoryById = computed(() => {
    const m = new Map<string, Category>();
    for (const c of this.categoriesStore.entities()) m.set(c.id, c);
    return m;
  });

  /** Same idea for vibe tags — lookup index for chip rendering. */
  protected vibeTagById = computed(() => {
    const m = new Map<string, string>();
    for (const t of this.vibeTagsStore.entities()) m.set(t.id, t.name);
    return m;
  });

  /** Sort options surfaced in the dropdown. Order is the display order. */
  protected readonly sortOptions: ReadonlyArray<{
    value: PlaceSort;
    label: string;
  }> = [
    { value: 'recent', label: 'Recently added' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'name-az', label: 'Name (A → Z)' },
    { value: 'name-za', label: 'Name (Z → A)' },
    { value: 'last-visited', label: 'Last visited' },
    { value: 'category', label: 'Category' },
    { value: 'favorite', label: 'Favorites first' },
  ];

  protected sortLabel = computed(
    () =>
      this.sortOptions.find((o) => o.value === this.facade.sort())?.label ??
      'Recently added'
  );

  /** Names of vibe tags for a place, in store order. */
  protected vibeTagsFor(ids: string[]): string[] {
    if (!ids?.length) return [];
    const map = this.vibeTagById();
    return ids
      .map((id) => map.get(id))
      .filter((n): n is string => Boolean(n));
  }

  /** Most recent visit.date as a friendly relative string. */
  protected lastVisitedLabel(p: Place): string | null {
    if (!p.visits?.length) return null;
    let max: string | null = null;
    for (const v of p.visits) {
      if (v.date && (max === null || v.date > max)) max = v.date;
    }
    if (!max) return null;
    return relativeShort(max);
  }

  // ---- Row interaction ----

  /**
   * Row click. In normal mode → open detail panel. In select mode → toggle
   * selection. Right-click anywhere on the row enters select mode (handled
   * by onRowContextMenu). Long-press also enters select mode.
   */
  protected onRowClick(p: Place): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (this.facade.selectMode()) {
      this.facade.toggle(p.id);
      return;
    }
    this.placeDetail?.open(p.id);
  }

  protected onRowContextMenu(event: MouseEvent, p: Place): void {
    event.preventDefault();
    if (!this.facade.selectMode()) {
      this.facade.enterSelectMode(p.id);
    } else {
      this.facade.toggle(p.id);
    }
  }

  protected onRowPointerDown(event: PointerEvent, p: Place): void {
    // Only the primary mouse button / touch triggers long-press.
    if (event.button !== 0) return;
    this.clearLongPress();
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.suppressNextClick = true;
      if (!this.facade.selectMode()) {
        this.facade.enterSelectMode(p.id);
      }
    }, LONG_PRESS_MS);
  }

  protected onRowPointerUp(): void {
    this.clearLongPress();
  }

  protected onRowPointerMove(): void {
    // Any movement cancels the press — avoids accidental entry while scrolling.
    this.clearLongPress();
  }

  protected onRowPointerCancel(): void {
    this.clearLongPress();
  }

  private clearLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  // ---- Detail panel ----

  protected onPlaceDetailClosed(): void {
    // No body — kept for future hooks (e.g. analytics).
  }

  protected onEditPlace(placeId: string): void {
    // Editing a place is owned by the add-place modal, which currently lives
    // in HomeComponent. Until that's lifted to the workspace shell (post-v1,
    // see HANDOVER_PHASE5.md §"Stretch"), the only way to edit from /places
    // is to navigate to / and reopen the place there. Pass the id via query
    // param so HomeComponent can pick it up.
    this.router.navigate(['/'], { queryParams: { edit: placeId } });
  }

  // ---- Sort menu ----

  protected toggleSortMenu(): void {
    this.showSortMenu.update((v) => !v);
  }

  protected pickSort(s: PlaceSort): void {
    this.facade.setSort(s);
    this.showSortMenu.set(false);
  }

  protected onSortBackdrop(): void {
    this.showSortMenu.set(false);
  }

  // ---- Filter popover ----

  protected toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  protected onFilterClosed(): void {
    this.showFilters.set(false);
  }

  // ---- Bulk action handlers ----

  protected onBulkMarkVisited(): void {
    void this.facade.bulkSetStatus('visited');
  }

  protected onBulkMarkPlanned(): void {
    void this.facade.bulkSetStatus('planned');
  }

  protected onBulkFavorite(): void {
    void this.facade.bulkSetFavorite(true);
  }

  protected onBulkUnfavorite(): void {
    void this.facade.bulkSetFavorite(false);
  }

  protected onBulkAddToCollection(): void {
    this.showCollectionPicker.set(true);
  }

  protected onCollectionPickerPicked(ids: string[]): void {
    this.showCollectionPicker.set(false);
    void this.facade.bulkAddToCollections(ids);
  }

  protected onCollectionPickerCancelled(): void {
    this.showCollectionPicker.set(false);
  }

  protected onBulkDelete(): void {
    this.showBulkDelete.set(true);
  }

  protected onBulkDeleteConfirmed(): void {
    this.showBulkDelete.set(false);
    void this.facade.bulkSoftDelete();
  }

  protected onBulkDeleteCancelled(): void {
    this.showBulkDelete.set(false);
  }
}

/**
 * Short relative-time label ("2d ago", "3w ago", "yesterday", "today"). Kept
 * local — Wayfinder doesn't have a shared date utility yet, and importing
 * a library for this would be overkill.
 */
function relativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const day = 86_400_000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))}w ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}mo ago`;
  return `${Math.floor(diff / (365 * day))}y ago`;
}