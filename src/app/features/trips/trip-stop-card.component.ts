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
      [class.visited]="stop().visitedDuringTrip"
      cdkDrag
    >
      <!-- Row 1: badge + name. Name gets the full remaining width so
           long place names display without wrapping with meta data. -->
      <div class="row row-1">
        <!-- Numbered badge — teal when visited, accent otherwise.
             Phase 7 follow-up: clickable. Tapping the badge marks the
             stop visited (or unmarks it). Same action as the right-side
             toggle button, but with a much bigger hit area. -->
        <button
          type="button"
          class="num"
          (click)="onBadgeClick($event)"
          [title]="stop().visitedDuringTrip ? 'Unmark visited' : 'Mark visited'"
          [attr.aria-label]="stop().visitedDuringTrip ? 'Unmark stop ' + (index() + 1) + ' visited' : 'Mark stop ' + (index() + 1) + ' visited'"
          [attr.aria-pressed]="stop().visitedDuringTrip"
        >
          @if (stop().visitedDuringTrip) {
            <i class="ti ti-check"></i>
          } @else {
            {{ index() + 1 }}
          }
        </button>

        @if (place(); as p) {
          <div class="nm">{{ p.customName ?? p.name }}</div>
        } @else {
          <div class="nm missing">Place no longer available</div>
        }
      </div>

      <!-- Row 2: meta info on the left, actions on the right. Indented
           so it visually sits under the name (badge column on the
           left). -->
      <div class="row row-2">
        <div class="meta">
          @if (place(); as p) {
            @if (category(); as c) {
              <i class="ti meta-cat-icon" [class]="'ti-' + c.icon" [style.color]="c.color"></i>
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
          } @else {
            <span class="dim">The original place was deleted. Remove this stop.</span>
          }
        </div>

        <div class="actions" (click)="$event.stopPropagation()">
          <!-- Phase 7 visited toggle. Visible on every stop card; clicking
               auto-starts the trip (via the facade's hybrid behavior) when
               the trip hadn't been started yet.
               When the trip is live, this button grows a text label so the
               primary action of the moment is obvious. When not live, it
               stays compact (icon-only) to avoid crowding the row. -->
          <button
            class="visited-toggle"
            [class.on]="stop().visitedDuringTrip"
            [class.labeled]="tripIsLive()"
            (click)="visitedToggle.emit(stop().id)"
            [title]="stop().visitedDuringTrip ? 'Unmark visited' : 'Mark visited'"
            [attr.aria-label]="stop().visitedDuringTrip ? 'Unmark visited' : 'Mark visited'"
            [attr.aria-pressed]="stop().visitedDuringTrip"
          >
            <i class="ti" [class]="stop().visitedDuringTrip ? 'ti-circle-check-filled' : 'ti-circle-check'"></i>
            @if (tripIsLive()) {
              <span class="visited-toggle-label">
                {{ stop().visitedDuringTrip ? 'Visited' : 'Mark visited' }}
              </span>
            }
          </button>

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

      <!-- Note section (full-width when shown) -->
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
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .stop {
        display: flex;
        flex-direction: column;
        gap: 4px;
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
      /* Row 1: badge + name. Name takes the full remaining width. */
      .row-1 {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;
      }
      /* Row 2: meta on the left, actions on the right. Indented past
         the badge column so it aligns visually under the name. */
      .row-2 {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-left: 40px; /* 28px badge + 12px row-1 gap */
        min-width: 0;
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
        /* Now a <button> rather than <span> — reset native button styles */
        border: none;
        padding: 0;
        cursor: pointer;
        font-family: var(--wf-font-display);
        transition: background 0.18s ease, transform 0.12s ease, box-shadow 0.12s ease;
      }
      .num:hover {
        transform: scale(1.08);
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--wf-accent) 18%, transparent);
      }
      .num:active {
        transform: scale(0.96);
      }
      .num:focus-visible {
        outline: 2px solid var(--wf-accent);
        outline-offset: 2px;
      }
      .num i {
        font-size: 14px;
      }
      /* Phase 7: visited stops get the teal "completed" color on the
         number badge. The stop card itself fades slightly so unvisited
         stops draw the eye while live. */
      .stop.visited .num {
        background: var(--wf-teal);
      }
      .stop.visited .num:hover {
        box-shadow: 0 0 0 4px color-mix(in srgb, var(--wf-teal) 22%, transparent);
      }
      .stop.visited {
        background: color-mix(in srgb, var(--wf-teal) 4%, var(--wf-bg));
      }
      .stop.visited .nm {
        color: var(--wf-ink-soft);
      }
      /* First and last stops get slightly more visual weight */
      .stop.start .num,
      .stop.end .num {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--wf-accent) 25%, transparent);
      }
      .stop.start.visited .num,
      .stop.end.visited .num {
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--wf-teal) 25%, transparent);
      }
      .nm {
        flex: 1;
        min-width: 0;
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
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--wf-ink-soft);
        flex-wrap: wrap;
      }
      .meta .dim {
        color: var(--wf-ink-faint);
        font-style: italic;
      }
      .meta .meta-cat-icon {
        font-size: 13px;
        flex-shrink: 0;
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
        margin: 0 0 0 40px; /* indent under name, matching row-2 */
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
        width: calc(100% - 40px);
        margin-left: 40px;
        margin-top: 2px;
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
      /* Phase 7 visited-toggle. Two visual modes:
         - Default (icon-only): same hit area as other .iconbtn buttons.
         - .labeled (when the trip is live): grows horizontally to fit a
           text label like "Mark visited" / "Visited". The trip planner
           sets the labeled mode by passing tripIsLive() into the card.

         Hollow circle by default, filled teal when the stop is visited.
         Hovering the off state hints at teal so the affordance reads as
         "tap to complete." */
      .visited-toggle {
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 0;
        background: transparent;
        border: 0.5px solid transparent;
        border-radius: 6px;
        color: var(--wf-ink-faint);
        cursor: pointer;
        font: inherit;
        font-size: 12px;
        white-space: nowrap;
      }
      /* Icon-only: square hit area, no text. */
      .visited-toggle:not(.labeled) {
        width: 26px;
      }
      /* Labeled: wider, with padding for the text. Primary affordance
         in live-trip mode. */
      .visited-toggle.labeled {
        padding: 0 10px 0 8px;
        background: color-mix(in srgb, var(--wf-teal) 6%, transparent);
        border-color: color-mix(in srgb, var(--wf-teal) 30%, transparent);
        color: var(--wf-teal);
        font-weight: 500;
      }
      .visited-toggle:hover {
        color: var(--wf-teal);
        background: color-mix(in srgb, var(--wf-teal) 10%, transparent);
        border-color: color-mix(in srgb, var(--wf-teal) 40%, transparent);
      }
      .visited-toggle.labeled:hover {
        background: color-mix(in srgb, var(--wf-teal) 14%, transparent);
        border-color: color-mix(in srgb, var(--wf-teal) 50%, transparent);
      }
      .visited-toggle.on {
        color: var(--wf-teal);
      }
      .visited-toggle.labeled.on {
        background: color-mix(in srgb, var(--wf-teal) 18%, transparent);
        border-color: color-mix(in srgb, var(--wf-teal) 50%, transparent);
      }
      .visited-toggle.on:hover {
        color: var(--wf-ink-soft);
        background: var(--wf-bg-2);
        border-color: var(--wf-hairline);
      }
      .visited-toggle.labeled.on:hover {
        color: var(--wf-ink-soft);
        background: var(--wf-bg-2);
        border-color: var(--wf-hairline);
      }
      .visited-toggle i {
        font-size: 14px;
      }
      .visited-toggle-label {
        font-size: 12px;
        line-height: 1;
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
  /**
   * Whether the parent trip is currently in progress. Drives whether the
   * visited toggle shows a text label (live = labeled, idle = icon-only)
   * so the primary action is obvious during a live trip. Optional with
   * default false so existing callers that don't know about live state
   * still work.
   */
  readonly tripIsLive = input<boolean>(false);

  readonly remove = output<string>();
  readonly noteChanged = output<{ stopId: string; note: string }>();
  /**
   * Emitted when the user clicks the visited toggle on this card OR the
   * number badge itself. Both affordances mark the stop visited. The
   * facade handles auto-starting the trip on first mark.
   */
  readonly visitedToggle = output<string>();

  protected showNote = signal(false);
  protected noteDraft = signal('');

  /**
   * Number badge is now interactive — tapping it marks the stop visited
   * (or unmarks it). Same behavior as the right-side toggle button, but
   * with a much bigger hit area. stopPropagation so we don't bubble into
   * the parent stop card if it has its own click handler later.
   */
  protected onBadgeClick(event: Event): void {
    event.stopPropagation();
    this.visitedToggle.emit(this.stop().id);
  }

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