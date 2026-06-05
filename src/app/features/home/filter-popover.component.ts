import {
  Component,
  computed,
  inject,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterStateStore } from '../../core/stores/filter-state.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { CollectionsStore } from '../../core/stores/collections.store';
import { VibeTagsStore } from '../../core/stores/vibe-tags.store';
import { MultiSelectComponent } from '../../shared/multi-select/multi-select.component';

@Component({
  selector: 'wf-filter-popover',
  standalone: true,
  imports: [FormsModule, MultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="popover">
      <div class="header">
        <h4>Filters</h4>
        <button class="close" (click)="closed.emit()" aria-label="Close">×</button>
      </div>

      <div class="filter-row">
        <wf-multi-select
          label="Categories"
          [options]="categoryOptions()"
          [selected]="selectedCategories()"
          (selectedChange)="onCategoryChange($event)"
        />

        @if (vibeOptions().length > 0) {
          <wf-multi-select
            label="Vibes"
            [options]="vibeOptions()"
            [selected]="selectedVibes()"
            (selectedChange)="onVibeChange($event)"
          />
        }

        @if (collectionOptions().length > 0) {
          <wf-multi-select
            label="Collections"
            [options]="collectionOptions()"
            [selected]="selectedCollections()"
            (selectedChange)="onCollectionChange($event)"
          />
        }

        <wf-multi-select
          label="Locality"
          [options]="localityOptions()"
          [selected]="selectedLocalities()"
          (selectedChange)="onLocalityChange($event)"
        />
      </div>

      <div class="actions">
        <button class="btn" (click)="filters.clearAll()">Clear all</button>
        <button class="btn primary" (click)="closed.emit()">Done</button>
      </div>
    </div>
  `,
  styles: [
    `
      .popover {
        position: absolute;
        top: 24px;
        left: 24px;
        width: 320px;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 12px 36px color-mix(in srgb, var(--wf-ink) 18%, transparent);
        z-index: 1000;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 14px;
      }
      h4 {
        margin: 0;
        font-family: var(--wf-font-display);
        font-size: 16px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .close {
        background: none;
        border: none;
        font-size: 20px;
        line-height: 1;
        color: var(--wf-ink-soft);
        cursor: pointer;
        padding: 2px 6px;
      }
      .close:hover { color: var(--wf-ink); }

      /* All filter dropdowns sit in one wrapping flex row so they wrap
         naturally on narrow viewports. */
      .filter-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 14px;
      }

      .actions {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        padding-top: 10px;
        border-top: 0.5px solid var(--wf-hairline);
      }
      .btn {
        padding: 8px 14px;
        font: inherit;
        font-size: 12px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        cursor: pointer;
        font-weight: 500;
      }
      .btn:hover { background: var(--wf-bg); }
      .btn.primary {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
    `,
  ],
})
export class FilterPopoverComponent {
  protected filters = inject(FilterStateStore);
  private categories = inject(CategoriesStore);
  private collections = inject(CollectionsStore);
  private vibeTags = inject(VibeTagsStore);

  readonly closed = output<void>();

  // ---- Dropdown options ----

  protected categoryOptions = computed(() =>
    [...this.categories.entities()]
      .filter((c) => !c.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name, icon: c.icon, iconColor: c.color }))
  );

  protected vibeOptions = computed(() =>
    [...this.vibeTags.entities()]
      .filter((v) => !v.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({ value: v.id, label: v.name }))
  );

  protected collectionOptions = computed(() =>
    [...this.collections.entities()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ value: c.id, label: c.name }))
  );

  protected localityOptions = computed(() =>
    this.filters.availableLocalities().map((l) => ({ value: l, label: l }))
  );

  // ---- Adapt store's string[] to ReadonlySet<string> for wf-multi-select ----

  protected selectedCategories = computed(
    () => new Set(this.filters.selectedCategoryIds()) as ReadonlySet<string>
  );
  protected selectedVibes = computed(
    () => new Set(this.filters.selectedVibeIds()) as ReadonlySet<string>
  );
  protected selectedCollections = computed(
    () => new Set(this.filters.selectedCollectionIds()) as ReadonlySet<string>
  );
  protected selectedLocalities = computed<ReadonlySet<string>>(() => {
    const loc = this.filters.selectedLocality();
    return new Set(loc ? [loc] : []);
  });

  // ---- Handlers: unwrap Set → array/string for the store ----

  protected onCategoryChange(s: ReadonlySet<string>): void {
    // Patch directly; FilterStateStore.selectedCategoryIds is string[]
    this.filters.setSelectedCategoryIds([...s]);
  }
  protected onVibeChange(s: ReadonlySet<string>): void {
    this.filters.setSelectedVibeIds([...s]);
  }
  protected onCollectionChange(s: ReadonlySet<string>): void {
    this.filters.setSelectedCollectionIds([...s]);
  }
  protected onLocalityChange(s: ReadonlySet<string>): void {
    // Single locality — take the first value or null
    const [first] = s;
    this.filters.setLocality(first ?? null);
  }
}