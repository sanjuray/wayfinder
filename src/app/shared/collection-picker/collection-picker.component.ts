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

import { CollectionsStore } from '../../core/stores/collections.store';
import {
  gradientCss,
  DEFAULT_COVER_ICON,
} from '../../core/constants/collection-covers';
import type { CollectionCoverGradient } from '../../core/models/collection.model';

/**
 * Reusable multi-select collection picker. Modal with a checkbox list of
 * every (non-deleted) collection plus an inline "+ New collection" affordance.
 *
 * Used by:
 *   - features/places/places-list  → bulk "add to collection"
 *   - features/trips (Phase 6)     → "which collections does this trip touch?"
 *
 * The handover doc (HANDOVER_PHASE5 §"What's likely to bite") called for
 * lifting this to shared/ on first use rather than building it twice — that's
 * what this is. Standalone component, no feature-folder dependencies.
 */
@Component({
  selector: 'wf-collection-picker',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="onCancel()"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <header class="hdr">
        <h3 id="picker-title">{{ title() }}</h3>
        <button class="close" (click)="onCancel()" aria-label="Close">×</button>
      </header>

      <div class="search-wrap">
        <i class="ti ti-search search-icon"></i>
        <input
          class="search"
          [ngModel]="query()"
          (ngModelChange)="query.set($event)"
          placeholder="Search collections"
          autofocus
        />
      </div>

      <div class="list">
        @if (filtered().length === 0 && query().trim().length > 0) {
          <p class="hint">No collections match "{{ query() }}".</p>
        } @else if (filtered().length === 0) {
          <p class="hint">No collections yet. Create one below.</p>
        }

        @for (c of filtered(); track c.id) {
          <label class="row">
            <input
              type="checkbox"
              [checked]="selected().has(c.id)"
              (change)="toggle(c.id)"
            />
            <span
              class="cover"
              [style.background]="renderGradient(c.coverGradient)"
            >
              <i class="ti" [class]="'ti-' + (c.coverIcon || defaultIcon)"></i>
            </span>
            <span class="nm">{{ c.name }}</span>
          </label>
        }
      </div>

      <div class="new-row">
        @if (!creating()) {
          <button class="new-btn" (click)="startCreating()">
            <i class="ti ti-plus"></i>
            New collection
          </button>
        } @else {
          <input
            class="new-input"
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            (keydown.enter)="confirmCreate()"
            (keydown.escape)="cancelCreate()"
            placeholder="Collection name"
            autofocus
          />
          <button class="btn small" (click)="cancelCreate()">Cancel</button>
          <button
            class="btn small primary"
            [disabled]="!newName().trim()"
            (click)="confirmCreate()"
          >
            Create
          </button>
        }
      </div>

      <footer class="ftr">
        <button class="btn" (click)="onCancel()">Cancel</button>
        <button
          class="btn primary"
          [disabled]="selected().size === 0"
          (click)="onConfirm()"
        >
          @if (selected().size === 0) {
            Pick collections
          } @else {
            Add to {{ selected().size }} {{ selected().size === 1 ? 'collection' : 'collections' }}
          }
        </button>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 3000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, var(--wf-ink) 40%, transparent);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      .modal {
        position: relative;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 14px;
        padding: 20px;
        width: 420px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 64px);
        display: flex;
        flex-direction: column;
        box-shadow: 0 24px 48px color-mix(in srgb, var(--wf-ink) 35%, transparent);
      }
      .hdr {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 14px;
      }
      h3 {
        margin: 0;
        font-family: var(--wf-font-display);
        font-size: 18px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .close {
        background: transparent;
        border: none;
        font-size: 22px;
        line-height: 1;
        color: var(--wf-ink-soft);
        cursor: pointer;
        padding: 0 4px;
      }
      .search-wrap {
        position: relative;
        margin-bottom: 12px;
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
        padding: 9px 12px 9px 32px;
        font: inherit;
        font-size: 13px;
        color: var(--wf-ink);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 10px;
      }
      .search:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .list {
        flex: 1;
        overflow-y: auto;
        margin: 0 -4px;
        padding: 0 4px;
        max-height: 40vh;
      }
      .hint {
        margin: 8px 0;
        font-size: 12px;
        color: var(--wf-ink-faint);
        text-align: center;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
      }
      .row:hover {
        background: var(--wf-bg-2);
      }
      .row input[type='checkbox'] {
        width: 16px;
        height: 16px;
        accent-color: var(--wf-accent);
        cursor: pointer;
      }
      .cover {
        width: 28px;
        height: 28px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        color: #fff;
      }
      .cover i {
        font-size: 14px;
      }
      .nm {
        font-size: 13px;
        color: var(--wf-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .new-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 0;
        margin: 4px 0;
        border-top: 0.5px solid var(--wf-hairline);
        border-bottom: 0.5px solid var(--wf-hairline);
      }
      .new-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 10px;
        font: inherit;
        font-size: 13px;
        color: var(--wf-accent);
        background: transparent;
        border: none;
        cursor: pointer;
      }
      .new-btn:hover {
        background: color-mix(in srgb, var(--wf-accent) 8%, transparent);
        border-radius: 8px;
      }
      .new-input {
        flex: 1;
        padding: 7px 10px;
        font: inherit;
        font-size: 13px;
        color: var(--wf-ink);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
      }
      .new-input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .ftr {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 14px;
      }
      .btn {
        padding: 9px 16px;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        border-radius: 10px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        cursor: pointer;
      }
      .btn.small {
        padding: 7px 10px;
        font-size: 12px;
      }
      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .btn.primary {
        background: var(--wf-accent);
        color: var(--wf-bg);
        border-color: var(--wf-accent);
      }
    `,
  ],
})
export class CollectionPickerComponent {
  private collectionsStore = inject(CollectionsStore);

  /** Heading text. Caller provides context — "Add 3 places to", etc. */
  readonly title = input<string>('Add to');

  readonly picked = output<string[]>();
  readonly cancelled = output<void>();

  protected query = signal('');
  protected selected = signal<ReadonlySet<string>>(new Set());

  protected creating = signal(false);
  protected newName = signal('');

  protected readonly defaultIcon = DEFAULT_COVER_ICON;

  protected filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.collectionsStore.entities();
    if (!q) return all;
    return all.filter((c) => c.name.toLowerCase().includes(q));
  });

  protected toggle(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected renderGradient(id: CollectionCoverGradient | undefined): string {
    return gradientCss(id);
  }

  protected startCreating(): void {
    this.creating.set(true);
    this.newName.set('');
  }

  protected cancelCreate(): void {
    this.creating.set(false);
    this.newName.set('');
  }

  protected async confirmCreate(): Promise<void> {
    const name = this.newName().trim();
    if (!name) return;
    const collection = await this.collectionsStore.create(name);
    this.selected.update((set) => {
      const next = new Set(set);
      next.add(collection.id);
      return next;
    });
    this.creating.set(false);
    this.newName.set('');
  }

  protected onConfirm(): void {
    if (this.selected().size === 0) return;
    this.picked.emit(Array.from(this.selected()));
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}