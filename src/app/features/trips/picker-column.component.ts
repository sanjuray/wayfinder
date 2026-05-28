import {
  Component,
  inject,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { CategoriesStore } from '../../core/stores/categories.store';
import { MultiSelectComponent } from '../../shared/multi-select/multi-select.component';
import type { Place, PlaceStatus, Category } from '../../core/models';

/**
 * Add-stop picker column for the trip planner. Phase 6d (iv) — replaces
 * the earlier modal popover with a slide-in right column.
 *
 * Behavior:
 *   - Hidden by default. Opens when the parent sets isOpen=true (parent
 *     calls this in response to "+ Add stop" click).
 *   - Stays open after each pick so the user can rapid-fire multiple stops.
 *   - Closes via the X button OR pressing Escape OR clicking outside the
 *     column. Map clicks don't close it — that risk was flagged and the
 *     close behavior is intentional: explicit-dismissal only, since map
 *     clicks happen all the time during planning.
 *
 * Filter state is LOCAL to this component — does not touch the global
 * FilterStateStore. Filters here don't affect the home map's filters.
 *
 * Layout: vertical column. Header with title + close. Then search input.
 * Then a row of filter buttons (using <wf-multi-select> for categories
 * and statuses, plus a favorites toggle). Then the place list. A "+ New
 * place" button lives at the top of the list as a permanent affordance.
 */
@Component({
  selector: 'wf-picker-column',
  standalone: true,
  imports: [FormsModule, MultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="picker" [class.open]="isOpen()" aria-label="Add a stop">
      <header class="hdr">
        <h3>Add a stop</h3>
        <button class="close" (click)="onClose()" aria-label="Close" title="Close (Esc)">×</button>
      </header>

      <div class="search-wrap">
        <i class="ti ti-search search-icon"></i>
        <input
          class="search"
          type="text"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          placeholder="Search by name or locality"
        />
      </div>

      <div class="filters">
        <wf-multi-select
          label="Categories"
          [options]="categoryOptions()"
          [selected]="selectedCategoryIds()"
          (selectedChange)="selectedCategoryIds.set($event)"
        />
        <wf-multi-select
          label="Status"
          [options]="statusOptions"
          [selected]="selectedStatuses()"
          (selectedChange)="onStatusChange($event)"
        />
        <button
          type="button"
          class="fav-toggle"
          [class.on]="favoriteOnly()"
          (click)="toggleFavoriteOnly()"
          [attr.aria-pressed]="favoriteOnly()"
          title="Favorites only"
        >
          <i class="ti ti-star"></i>
          <span>Favorites</span>
        </button>
        @if (anyFilterActive()) {
          <button class="clear" (click)="clearFilters()">
            <i class="ti ti-x"></i>
            Clear
          </button>
        }
      </div>

      <!-- New place affordance at the top of the list -->
      <button class="new-place" (click)="newPlace.emit()">
        <i class="ti ti-plus"></i>
        Save a new place
      </button>

      <div class="list">
        @if (filtered().length === 0) {
          @if (availablePlaces().length === 0) {
            <p class="hint">
              All your saved places are already in this trip. Add a new one above.
            </p>
          } @else if (query().trim() || anyFilterActive()) {
            <p class="hint">No places match these filters.</p>
          } @else {
            <p class="hint">No places to add.</p>
          }
        } @else {
          @for (p of filtered(); track p.id) {
            @let cat = categoryById().get(p.categoryId);
            <button class="pick" (click)="onPick(p.id)">
              <span class="pick-info">
                <span class="pick-nm">
                  @if (p.isFavorite) {
                    <i class="ti ti-star fav"></i>
                  }
                  {{ p.customName ?? p.name }}
                </span>
                <span class="pick-meta">
                  @if (cat) {
                    <i class="ti" [class]="'ti-' + cat.icon" [style.color]="cat.color"></i>
                    <span>{{ cat.name }}</span>
                  }
                  @if (p.locality) {
                    <span class="sep">·</span>
                    <span>{{ p.locality }}</span>
                  }
                </span>
              </span>
              <span class="pick-add" aria-label="Add as next stop">
                <i class="ti ti-plus"></i>
              </span>
            </button>
          }
        }
      </div>

      <footer class="ftr">
        <span class="count">
          {{ filtered().length }} of {{ availablePlaces().length }}
        </span>
      </footer>
    </aside>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .picker {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 340px;
        max-width: 90vw;
        background: var(--wf-bg);
        border-left: 0.5px solid var(--wf-hairline);
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 14px;
        z-index: 600;
        box-shadow: -8px 0 24px color-mix(in srgb, var(--wf-ink) 8%, transparent);
        transform: translateX(100%);
        transition: transform 0.2s ease;
      }
      .picker.open {
        transform: translateX(0);
      }

      .hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      h3 {
        margin: 0;
        font-family: var(--wf-font-display);
        font-size: 16px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .close {
        background: transparent;
        border: none;
        font-size: 20px;
        line-height: 1;
        color: var(--wf-ink-soft);
        cursor: pointer;
        padding: 0 6px;
      }
      .close:hover {
        color: var(--wf-ink);
      }

      .search-wrap {
        position: relative;
      }
      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--wf-ink-faint);
        font-size: 14px;
        pointer-events: none;
      }
      .search {
        width: 100%;
        padding: 8px 10px 8px 30px;
        font: inherit;
        font-size: 13px;
        color: var(--wf-ink);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
      }
      .search:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .fav-toggle {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 6px 10px;
        font: inherit;
        font-size: 12px;
        color: var(--wf-ink-soft);
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
        cursor: pointer;
      }
      .fav-toggle:hover {
        border-color: var(--wf-ink-faint);
        color: var(--wf-ink);
      }
      .fav-toggle.on {
        border-color: var(--wf-gold);
        color: var(--wf-gold);
        background: color-mix(in srgb, var(--wf-gold) 10%, transparent);
      }
      .fav-toggle i {
        font-size: 13px;
      }
      .clear {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 6px 8px;
        font: inherit;
        font-size: 11px;
        color: var(--wf-ink-faint);
        background: transparent;
        border: 0.5px dashed var(--wf-hairline);
        border-radius: 8px;
        cursor: pointer;
      }
      .clear:hover {
        color: var(--wf-accent);
        border-color: var(--wf-accent);
        border-style: solid;
      }
      .clear i {
        font-size: 11px;
      }

      .new-place {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 9px 12px;
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        color: var(--wf-accent);
        background: transparent;
        border: 0.5px dashed var(--wf-accent);
        border-radius: 8px;
        cursor: pointer;
        align-self: flex-start;
      }
      .new-place:hover {
        background: color-mix(in srgb, var(--wf-accent) 8%, transparent);
      }
      .new-place i {
        font-size: 14px;
      }

      .list {
        flex: 1;
        overflow-y: auto;
        margin: 0 -4px;
        padding: 0 4px;
        min-height: 80px;
      }
      .hint {
        padding: 20px 12px;
        font-size: 12px;
        color: var(--wf-ink-faint);
        text-align: center;
        line-height: 1.5;
      }
      .pick {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 9px 10px;
        background: transparent;
        border: 0.5px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        font: inherit;
        text-align: left;
        color: var(--wf-ink);
      }
      .pick:hover {
        background: var(--wf-bg-2);
        border-color: var(--wf-hairline);
      }
      .pick-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .pick-nm {
        font-family: var(--wf-font-display);
        font-size: 14px;
        font-weight: 500;
        color: var(--wf-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .fav {
        color: var(--wf-gold);
        font-size: 12px;
      }
      .pick-meta {
        font-size: 11px;
        color: var(--wf-ink-soft);
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .pick-meta i {
        font-size: 12px;
      }
      .pick-meta .sep {
        color: var(--wf-ink-faint);
      }
      .pick-add {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--wf-accent);
        color: var(--wf-bg);
        opacity: 0;
        transition: opacity 0.12s;
      }
      .pick-add i {
        font-size: 12px;
      }
      .pick:hover .pick-add {
        opacity: 1;
      }

      .ftr {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        padding-top: 4px;
        border-top: 0.5px solid var(--wf-hairline);
      }
      .count {
        font-size: 11px;
        color: var(--wf-ink-faint);
      }
    `,
  ],
})
export class PickerColumnComponent {
  protected categories = inject(CategoriesStore);

  /** Whether the column is visible. Drives the CSS slide-in animation. */
  readonly isOpen = input.required<boolean>();

  /** Places the user can still add (not already in the trip). */
  readonly availablePlaces = input.required<Place[]>();

  readonly picked = output<string>();
  readonly cancelled = output<void>();
  readonly newPlace = output<void>();

  protected query = signal('');

  // ---- Local filter state ----

  protected selectedCategoryIds = signal<ReadonlySet<string>>(new Set());
  protected selectedStatuses = signal<ReadonlySet<string>>(new Set());
  protected favoriteOnly = signal(false);

  protected readonly statusOptions = [
    { value: 'planned' as PlaceStatus, label: 'Planned' },
    { value: 'visited' as PlaceStatus, label: 'Visited' },
  ];

  protected categoryOptions = computed(() =>
    this.categories.entities().map((c) => ({
      value: c.id,
      label: c.name,
      icon: c.icon,
      iconColor: c.color,
    }))
  );

  protected categoryById = computed(() => {
    const m = new Map<string, Category>();
    for (const c of this.categories.entities()) m.set(c.id, c);
    return m;
  });

  protected anyFilterActive = computed(
    () =>
      this.selectedCategoryIds().size > 0 ||
      this.selectedStatuses().size > 0 ||
      this.favoriteOnly()
  );

  protected filtered = computed<Place[]>(() => {
    const q = this.query().trim().toLowerCase();
    const catIds = this.selectedCategoryIds();
    const statuses = this.selectedStatuses();
    const favOnly = this.favoriteOnly();

    return this.availablePlaces().filter((p) => {
      if (favOnly && !p.isFavorite) return false;
      if (catIds.size > 0 && !catIds.has(p.categoryId)) return false;
      if (statuses.size > 0 && !statuses.has(p.status)) return false;
      if (q) {
        const name = (p.customName ?? p.name).toLowerCase();
        const loc = (p.locality ?? '').toLowerCase();
        if (!name.includes(q) && !loc.includes(q)) return false;
      }
      return true;
    });
  });

  // The multi-select uses string values; we widen the type when accepting
  // status selections back from it.
  protected onStatusChange(next: ReadonlySet<string>): void {
    this.selectedStatuses.set(next);
  }

  protected toggleFavoriteOnly(): void {
    this.favoriteOnly.update((v) => !v);
  }

  protected clearFilters(): void {
    this.selectedCategoryIds.set(new Set());
    this.selectedStatuses.set(new Set());
    this.favoriteOnly.set(false);
  }

  protected onPick(id: string): void {
    this.picked.emit(id);
  }

  protected onClose(): void {
    this.cancelled.emit();
  }
}