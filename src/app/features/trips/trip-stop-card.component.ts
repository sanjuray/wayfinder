import {
  Component,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import type { TripStop, Place, Category } from '../../core/models';

/**
 * Single stop row in the trip-plan stops column. Drag-drop is provided by
 * the parent's CdkDropList; this component contributes the CdkDrag + drag
 * handle. The handle (grip icon) sits on the RIGHT side, matching the
 * mockup layout.
 *
 * Up/down arrow buttons were removed in Phase 6c — they were redundant
 * with the drag handle, which CDK makes keyboard-accessible out of the
 * box (focus the handle, Space + arrow keys to reorder).
 *
 * Layout (matches mockup):
 *
 *   [N]  Name                                                   [⋮⋮]
 *        <category-icon> category · short metadata
 *        > optional per-stop note (kept; useful for "book ahead" etc.)
 *
 * The `.start` / `.end` classes on first/last stops give them subtle
 * visual differentiation (slightly emphasized number bubble), as in the
 * mockup. Note the parent applies these classes via [class.start] /
 * [class.end] bindings.
 */
@Component({
  selector: 'wf-trip-stop-card',
  standalone: true,
  imports: [FormsModule, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="stop"
      [class.start]="index() === 0"
      [class.end]="index() === totalCount() - 1"
      cdkDrag
    >
      <!-- Numbered badge -->
      <span class="num">{{ index() + 1 }}</span>

      <!-- Main info -->
      <div class="info">
        @if (place(); as p) {
          <div class="nm">{{ p.customName ?? p.name }}</div>
          <div class="meta">
            @if (category(); as c) {
              <i class="ti" [class]="'ti-' + c.icon" [style.color]="c.color"></i>
              <span class="cat">{{ c.name }}</span>
            }
            @if (p.locality) {
              <span class="sep">·</span>
              <span class="locality">{{ p.locality }}</span>
            }
            <span
              class="badge"
              [class.visited]="p.status === 'visited'"
              [class.planned]="p.status === 'planned'"
            >
              {{ p.status }}
            </span>
          </div>
        } @else {
          <div class="nm missing">Place no longer available</div>
          <div class="meta dim">The original place was deleted. Remove this stop.</div>
        }

        @if (showNote()) {
          <textarea
            class="note-input"
            rows="2"
            [ngModel]="noteDraft()"
            (ngModelChange)="noteDraft.set($event)"
            (blur)="commitNote()"
            placeholder="A note for this stop (optional)"
            (click)="$event.stopPropagation()"
          ></textarea>
        } @else if (stop().perStopNote) {
          <p class="note-shown" (click)="toggleNoteEditor($event)">
            <i class="ti ti-note"></i>
            {{ stop().perStopNote }}
          </p>
        }
      </div>

      <!-- Right-side actions: note toggle (if no note), remove, drag handle -->
      <div class="actions" (click)="$event.stopPropagation()">
        @if (!showNote() && !stop().perStopNote) {
          <button
            class="iconbtn"
            (click)="toggleNoteEditor($event)"
            title="Add a note"
            aria-label="Add a note"
          >
            <i class="ti ti-note"></i>
          </button>
        }
        <button
          class="iconbtn danger"
          (click)="remove.emit(stop().id)"
          title="Remove stop"
          aria-label="Remove stop"
        >
          <i class="ti ti-x"></i>
        </button>
        <button
          class="grip"
          cdkDragHandle
          aria-label="Drag to reorder"
          title="Drag to reorder (Space + arrows for keyboard)"
          (click)="$event.stopPropagation()"
        >
          <i class="ti ti-grip-vertical"></i>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .stop {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 14px;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 10px;
        transition: background 0.12s, border-color 0.12s;
      }
      .stop:hover {
        background: var(--wf-bg-2);
      }
      /* CDK applies these classes during drag */
      .stop.cdk-drag-preview {
        box-shadow: 0 12px 24px color-mix(in srgb, var(--wf-ink) 25%, transparent);
        background: var(--wf-bg);
      }
      .stop.cdk-drag-placeholder {
        opacity: 0.3;
        background: var(--wf-bg-2);
      }
      .num {
        flex-shrink: 0;
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--wf-accent);
        color: var(--wf-bg);
        font-family: var(--wf-font-display);
        font-size: 13px;
        font-weight: 600;
        border-radius: 50%;
        margin-top: 1px;
      }
      /* First and last stops get slightly more visual weight */
      .stop.start .num,
      .stop.end .num {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--wf-accent) 25%, transparent);
      }
      .info {
        flex: 1;
        min-width: 0;
      }
      .nm {
        font-family: var(--wf-font-display);
        font-size: 15px;
        font-weight: 500;
        color: var(--wf-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .nm.missing {
        color: var(--wf-ink-faint);
        font-style: italic;
      }
      .meta {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
        font-size: 12px;
        color: var(--wf-ink-soft);
        flex-wrap: wrap;
      }
      .meta.dim {
        color: var(--wf-ink-faint);
        font-style: italic;
      }
      .meta i {
        font-size: 13px;
      }
      .sep {
        color: var(--wf-ink-faint);
      }
      .badge {
        padding: 1px 7px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
        text-transform: lowercase;
        margin-left: 2px;
      }
      .badge.visited {
        background: color-mix(in srgb, var(--wf-teal) 18%, transparent);
        color: var(--wf-teal);
      }
      .badge.planned {
        background: color-mix(in srgb, var(--wf-ink) 8%, transparent);
        color: var(--wf-ink-soft);
      }
      .note-shown {
        margin: 8px 0 0;
        font-size: 12px;
        color: var(--wf-ink-soft);
        font-style: italic;
        cursor: pointer;
        display: flex;
        align-items: flex-start;
        gap: 5px;
      }
      .note-shown i {
        color: var(--wf-ink-faint);
        margin-top: 1px;
      }
      .note-shown:hover {
        color: var(--wf-ink);
      }
      .note-input {
        width: 100%;
        margin-top: 8px;
        padding: 8px 10px;
        font: inherit;
        font-size: 13px;
        color: var(--wf-ink);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 8px;
        resize: vertical;
        min-height: 56px;
      }
      .note-input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .actions {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
      }
      .iconbtn,
      .grip {
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 0.5px solid transparent;
        border-radius: 6px;
        color: var(--wf-ink-soft);
        cursor: pointer;
        font: inherit;
        padding: 0;
      }
      .iconbtn:hover {
        background: var(--wf-bg-2);
        border-color: var(--wf-hairline);
        color: var(--wf-ink);
      }
      .iconbtn.danger:hover {
        color: var(--wf-accent);
        background: color-mix(in srgb, var(--wf-accent) 10%, transparent);
        border-color: color-mix(in srgb, var(--wf-accent) 40%, transparent);
      }
      .grip {
        cursor: grab;
        color: var(--wf-ink-faint);
      }
      .grip:hover {
        color: var(--wf-ink-soft);
        background: var(--wf-bg-2);
      }
      .grip:active,
      .stop.cdk-drag-dragging .grip {
        cursor: grabbing;
      }
      .iconbtn i,
      .grip i {
        font-size: 14px;
      }
    `,
  ],
})
export class TripStopCardComponent {
  readonly stop = input.required<TripStop>();
  readonly place = input.required<Place | null>();
  readonly category = input.required<Category | null>();
  readonly index = input.required<number>();
  readonly totalCount = input.required<number>();

  readonly remove = output<string>();
  readonly noteChanged = output<{ stopId: string; note: string }>();

  protected showNote = signal(false);
  protected noteDraft = signal('');

  protected toggleNoteEditor(event: Event): void {
    event.stopPropagation();
    if (!this.showNote()) {
      this.noteDraft.set(this.stop().perStopNote ?? '');
      this.showNote.set(true);
    } else {
      this.showNote.set(false);
    }
  }

  protected commitNote(): void {
    const next = this.noteDraft().trim();
    const current = this.stop().perStopNote ?? '';
    if (next !== current) {
      this.noteChanged.emit({ stopId: this.stop().id, note: next });
    }
    this.showNote.set(false);
  }
}