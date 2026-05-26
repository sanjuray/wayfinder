import {
  Component,
  inject,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FilterStateStore } from '../../core/stores/filter-state.store';
import { CategoriesStore } from '../../core/stores/categories.store';

@Component({
  selector: 'wf-filter-popover',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="popover">
      <div class="header">
        <h4>Filters</h4>
        <button class="close" (click)="closed.emit()" aria-label="Close">×</button>
      </div>

      <section>
        <div class="label">Categories</div>
        <div class="chips">
          @for (cat of categories.entities(); track cat.id) {
            <button
              class="chip"
              [class.sel]="filters.selectedCategoryIds().includes(cat.id)"
              (click)="filters.toggleCategoryInPopover(cat.id)"
            >
              {{ cat.name }}
            </button>
          }
        </div>
      </section>

<section>
        <div class="label">Locality</div>
        <select
          class="select"
          [ngModel]="filters.selectedLocality()"
          (ngModelChange)="filters.setLocality($event)"
        >
          <option [ngValue]="null">All localities</option>
          @for (loc of filters.availableLocalities(); track loc) {
            <option [ngValue]="loc">{{ loc }}</option>
          }
        </select>
      </section>

      <!-- Extension placeholder: vibes, statuses, favorites — UI not yet wired -->

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
        width: 280px;
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
      section { margin-bottom: 16px; }
      .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--wf-ink-faint);
        margin-bottom: 6px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
}
      .chip {
        padding: 6px 10px;
        font-size: 12px;
        border-radius: 14px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        cursor: pointer;
      }
      .chip.sel {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
      .select {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        font: inherit;
font-size: 13px;
        color: var(--wf-ink);
      }
      .actions {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-top: 6px;
      }
      .btn {
        padding: 8px 14px;
        font-size: 12px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        cursor: pointer;
        font-weight: 500;
      }
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
  protected categories = inject(CategoriesStore);

  readonly closed = output<void>();
}


