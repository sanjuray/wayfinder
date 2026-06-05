import {
  Component,
  HostListener,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

/**
 * One option in the multi-select. Values are strings (use category ids,
 * status values, etc.) — keeps the component simple and serialization-safe.
 */
export interface MultiSelectOption {
  value: string;
  label: string;
  /** Optional small icon (tabler class name without the 'ti-' prefix). */
  icon?: string;
  /** Optional accent color for the icon (CSS color value). */
  iconColor?: string;
}

/**
 * Generic multi-select dropdown. Button shows the label + a count of
 * selected values; clicking opens a checkbox list. Selection is held by
 * the parent (via two-way binding on `selected` / `selectedChange`) so
 * the component itself is stateless about its choices — fits well with
 * signal-based parents.
 *
 * Used by the trip planner's filter drawer (categories, statuses, vibe
 * tags). Designed to be drop-in elsewhere too (placement: shared/ per the
 * architecture rule that any 2+-caller UI belongs in shared/).
 */
@Component({
  selector: 'wf-multi-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ms" [class.open]="open()">
      <button
        type="button"
        class="ms-button"
        [class.has-selection]="selected().size > 0"
        (click)="toggle($event)"
        [attr.aria-expanded]="open()"
        aria-haspopup="listbox"
      >
        <span class="ms-label">{{ label() }}</span>
        @if (selected().size > 0) {
          <span class="ms-count">{{ selected().size }}</span>
        }
        <svg
          class="ms-chev"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      @if (open()) {
        <div class="ms-popover" role="listbox" (click)="$event.stopPropagation()">
          @if (options().length === 0) {
            <div class="ms-empty">No options</div>
          } @else {
            @for (opt of options(); track opt.value) {
              <label class="ms-row">
                <input
                  type="checkbox"
                  [checked]="selected().has(opt.value)"
                  (change)="toggleOption(opt.value)"
                />
                @if (opt.icon) {
                  <i class="ti" [class]="'ti-' + opt.icon" [style.color]="opt.iconColor"></i>
                }
                <span class="ms-row-label">{{ opt.label }}</span>
              </label>
            }
            @if (selected().size > 0) {
              <button class="ms-clear" type="button" (click)="clearAll()">
                Clear selection
              </button>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
      }
      .ms {
        position: relative;
      }
      .ms-button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        font: inherit;
        font-size: 12px;
        color: var(--wf-ink-soft);
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
        cursor: pointer;
        white-space: nowrap;
      }
      .ms-button:hover {
        border-color: var(--wf-ink-faint);
        color: var(--wf-ink);
      }
      .ms-button.has-selection {
        border-color: var(--wf-accent);
        color: var(--wf-accent);
        background: color-mix(in srgb, var(--wf-accent) 8%, transparent);
      }
      .ms-label {
        font-weight: 500;
      }
      .ms-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        background: var(--wf-accent);
        color: var(--wf-bg);
        border-radius: 999px;
        font-size: 10px;
        font-weight: 600;
      }
      .ms-chev {
        transition: transform 0.12s ease;
        opacity: 0.6;
      }
      .ms.open .ms-chev {
        transform: rotate(180deg);
      }

      .ms-popover {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 100;
        min-width: 180px;
        max-height: 280px;
        overflow-y: auto;
        padding: 4px;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
        box-shadow:
          0 8px 24px rgba(0, 0, 0, 0.12),
          0 2px 6px rgba(0, 0, 0, 0.06);
      }
      .ms-empty {
        padding: 12px;
        font-size: 12px;
        color: var(--wf-ink-faint);
        text-align: center;
      }
      .ms-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        color: var(--wf-ink);
      }
      .ms-row:hover {
        background: var(--wf-bg-2);
      }
      .ms-row input[type='checkbox'] {
        accent-color: var(--wf-accent);
        cursor: pointer;
      }
      .ms-row i {
        font-size: 13px;
      }
      .ms-row-label {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .ms-clear {
        display: block;
        width: 100%;
        margin-top: 4px;
        padding: 6px 8px;
        background: transparent;
        border: none;
        border-top: 0.5px solid var(--wf-hairline);
        font: inherit;
        font-size: 11px;
        color: var(--wf-ink-faint);
        cursor: pointer;
        text-align: left;
      }
      .ms-clear:hover {
        color: var(--wf-accent);
      }
    `,
  ],
})
export class MultiSelectComponent {
  private hostEl = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Display label on the button when nothing is selected. */
  readonly label = input.required<string>();

  /** Available options. */
  readonly options = input.required<MultiSelectOption[]>();

  /** Currently selected values as a Set. Use [selected] for two-way; emit on change. */
  readonly selected = input.required<ReadonlySet<string>>();

  readonly selectedChange = output<ReadonlySet<string>>();

  protected open = signal(false);

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  protected toggleOption(value: string): void {
    const next = new Set(this.selected());
    if (next.has(value)) next.delete(value);
    else next.add(value);
    this.selectedChange.emit(next);
  }

  protected clearAll(): void {
    this.selectedChange.emit(new Set());
  }

  // Close on outside click + Escape — matches the rest of the app's small menus.
  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent): void {
    if (!this.open()) return;
    if (!this.hostEl.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    if (this.open()) this.open.set(false);
  }
}

