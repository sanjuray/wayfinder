import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MultiSelectComponent } from '../../shared/multi-select/multi-select.component';
import type { TravelMode } from '../../core/models';

/**
 * Filter shape applied by the trips-so-far page. Held in the parent's
 * signals; this component just renders inputs that drive it.
 *
 * `query` — case-insensitive substring match against trip name.
 * `statuses` — set of section keys ('in-progress' | 'upcoming' | 'draft' | 'past').
 *              Empty set = no status filter (all sections visible).
 * `travelModes` — set of TravelMode values. Empty set = no travel-mode filter.
 */
export interface TripsFilterState {
  query: string;
  statuses: ReadonlySet<string>;
  travelModes: ReadonlySet<string>;
}

/**
 * Filter popover for the trips list. Opens anchored below the Filter
 * button in the page header. Closes on outside click + Escape.
 *
 * Three filters chosen for v1 (Phase 6e):
 *   - Search by trip name (free text)
 *   - Status multi-select (in-progress / upcoming / draft / past)
 *   - Travel mode multi-select (walking / driving / cycling / transit / auto)
 *
 * State is owned by the parent — we emit changes via `filterChange`. This
 * keeps the component drop-in elsewhere if needed and means the parent's
 * computed-section logic re-runs naturally on any change.
 */
@Component({
  selector: 'wf-trips-filter-popover',
  standalone: true,
  imports: [FormsModule, MultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="popover" role="dialog" (click)="$event.stopPropagation()">
      <header class="hdr">
        <h4>Filters</h4>
        <button class="close" (click)="cancelled.emit()" aria-label="Close">×</button>
      </header>

      <div class="field">
        <label class="lbl">Search by name</label>
        <input
          class="input"
          type="text"
          [ngModel]="filter().query"
          (ngModelChange)="updateQuery($event)"
          placeholder="e.g. Kyoto"
          autofocus
        />
      </div>

      <div class="field">
        <label class="lbl">Status</label>
        <wf-multi-select
          label="Any"
          [options]="statusOptions"
          [selected]="filter().statuses"
          (selectedChange)="updateStatuses($event)"
        />
      </div>

      <div class="field">
        <label class="lbl">Travel mode</label>
        <wf-multi-select
          label="Any"
          [options]="travelModeOptions"
          [selected]="filter().travelModes"
          (selectedChange)="updateTravelModes($event)"
        />
      </div>

      <footer class="ftr">
        @if (anyFilterActive()) {
          <button class="link" (click)="clearAll()">Clear all</button>
        } @else {
          <span class="hint">No filters applied</span>
        }
        <button class="btn primary" (click)="cancelled.emit()">Done</button>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 1100;
      }
      .popover {
        width: 320px;
        max-width: calc(100vw - 32px);
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 12px;
        box-shadow:
          0 12px 32px rgba(0, 0, 0, 0.14),
          0 4px 10px rgba(0, 0, 0, 0.06);
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      h4 {
        margin: 0;
        font-family: var(--wf-font-display);
        font-size: 15px;
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
        padding: 0 4px;
      }
      .close:hover {
        color: var(--wf-ink);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .lbl {
        font-size: 11px;
        color: var(--wf-ink-faint);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .input {
        padding: 8px 11px;
        font: inherit;
        font-size: 13px;
        color: var(--wf-ink);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
      }
      .input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .ftr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding-top: 6px;
        border-top: 0.5px solid var(--wf-hairline);
      }
      .link {
        background: transparent;
        border: none;
        font: inherit;
        font-size: 12px;
        color: var(--wf-ink-soft);
        cursor: pointer;
        padding: 0;
      }
      .link:hover {
        color: var(--wf-accent);
      }
      .hint {
        font-size: 11px;
        color: var(--wf-ink-faint);
      }
      .btn {
        padding: 7px 14px;
        font: inherit;
        font-size: 12px;
        font-weight: 500;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        cursor: pointer;
      }
      .btn.primary {
        background: var(--wf-accent);
        border-color: var(--wf-accent);
        color: var(--wf-bg);
      }
    `,
  ],
})
export class TripsFilterPopoverComponent {
  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly filter = input.required<TripsFilterState>();
  readonly filterChange = output<TripsFilterState>();
  readonly cancelled = output<void>();

  protected readonly statusOptions = [
    { value: 'in-progress', label: 'In progress' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'draft', label: 'Draft' },
    { value: 'past', label: 'Past' },
  ];

  protected readonly travelModeOptions: Array<{ value: TravelMode; label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'walking', label: 'Walking' },
    { value: 'driving', label: 'Driving' },
    { value: 'cycling', label: 'Cycling' },
    { value: 'transit', label: 'Transit' },
  ];

  protected updateQuery(query: string): void {
    this.filterChange.emit({ ...this.filter(), query });
  }

  protected updateStatuses(statuses: ReadonlySet<string>): void {
    this.filterChange.emit({ ...this.filter(), statuses });
  }

  protected updateTravelModes(travelModes: ReadonlySet<string>): void {
    this.filterChange.emit({ ...this.filter(), travelModes });
  }

  protected anyFilterActive(): boolean {
    const f = this.filter();
    return (
      f.query.trim().length > 0 ||
      f.statuses.size > 0 ||
      f.travelModes.size > 0
    );
  }

  protected clearAll(): void {
    this.filterChange.emit({
      query: '',
      statuses: new Set(),
      travelModes: new Set(),
    });
  }

  // Outside click closes — but only when the click target isn't the
  // Filter button that opened us (parent stops propagation there).
  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent): void {
    if (!this.hostEl.nativeElement.contains(event.target as Node)) {
      this.cancelled.emit();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.cancelled.emit();
  }
}