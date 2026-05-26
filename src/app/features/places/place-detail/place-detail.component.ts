import {
  Component,
  inject,
  output,
  signal,
  HostListener,
  ChangeDetectionStrategy,
} from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlaceDetailFacade } from './place-detail.facade';
import { CategoriesStore } from '../../../core/stores/categories.store';
import { CollectionsStore } from '../../../core/stores/collections.store';
import { VibeTagsStore } from '../../../core/stores/vibe-tags.store';
import { DeleteConfirmComponent } from './delete-confirm.component';
import type { VisitRating } from '../../../core/models';

/**
 * Place detail panel. Slides in from the right.
 *
 * Phase 3c carryover changes:
 *  - Panel sized to match left sidebar width (240px), starts below the
 *    topbar so the Settings gear and other topbar controls stay clickable.
 *  - Transparent backdrop captures outside-clicks; clicking it commits any
 *    pending name edit and closes the panel.
 *  - "Let it go" bottom button replaced by a small trash icon (red) next
 *    to the pencil edit button in the name row.
 *  - Open in Google Maps now uses a smart query (name + address) instead
 *    of raw coords. See facade for details.
 */
@Component({
  selector: 'wf-place-detail',
  standalone: true,
  providers: [PlaceDetailFacade],
  imports: [DecimalPipe, DatePipe, FormsModule, DeleteConfirmComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (facade.place()) {
      <!-- Transparent backdrop captures outside-clicks. -->
      <div class="backdrop" (click)="onBackdropClick()"></div>
    }

    <aside class="panel" [class.show]="!!facade.place()" aria-label="Place details">
      @if (facade.place(); as p) {
        <section class="hero">
          <div class="name-row">
            @if (facade.editingName()) {
              <input
                class="name-input"
                [ngModel]="facade.editedName()"
                (ngModelChange)="facade.editedName.set($event)"
                (keydown.enter)="facade.saveEditedName()"
                (keydown.escape)="facade.cancelEditName()"
                autofocus
              />
              <div class="name-actions">
                <button class="link" (click)="facade.cancelEditName()">Cancel</button>
                <button class="link primary" (click)="facade.saveEditedName()">Save</button>
              </div>
            } @else {
              <h2 class="name">{{ facade.displayName() }}</h2>
              <div class="name-icons">
                <button
                  class="row-icon"
                  (click)="facade.startEditName()"
                  aria-label="Edit name"
                  title="Rename"
                >
                  <i class="ti ti-pencil"></i>
                </button>
                <button
                  class="row-icon danger"
                  (click)="showDelete.set(true)"
                  aria-label="Delete place"
                  title="Let it go"
                >
                  <i class="ti ti-trash"></i>
                </button>
                <button
                  class="row-icon close"
                  (click)="onClose()"
                  aria-label="Close"
                  title="Close"
                >
                  <i class="ti ti-x"></i>
                </button>
              </div>
            }
          </div>

          <div class="meta-row">
            @if (categoryFor(p.categoryId); as cat) {
              <span class="cat-badge">
                <span class="cat-dot" [style.background]="cat.color"></span>
                {{ cat.name }}
              </span>
            }
            <button
              class="status-toggle"
              [class.visited]="p.status === 'visited'"
              (click)="facade.toggleStatus()"
              aria-label="Toggle status"
            >
              {{ p.status === 'visited' ? '✓ visited' : '○ planned' }}
            </button>
            <button
              class="fav-toggle"
              [class.on]="p.isFavorite"
              (click)="facade.toggleFavorite()"
              aria-label="Toggle favorite"
            >
              ✦
            </button>
          </div>
        </section>

        <section class="block">
          <div class="label">Address</div>
          <p class="addr">
            @if (p.displayAddress && p.name && p.name !== p.displayAddress) {
              <span class="addr-name">{{ p.name }}</span>
              <span class="addr-sep"> — </span>
              <span class="addr-rest">{{ p.displayAddress }}</span>
            } @else {
              {{ p.displayAddress || p.name }}
            }
          </p>
          <p class="coords">
            {{ p.lat | number: '1.4-4' }}°N, {{ p.lng | number: '1.4-4' }}°E
          </p>
        </section>

        @if (vibeTags(p.vibeTagIds); as vibes) {
          @if (vibes.length > 0) {
            <section class="block">
              <div class="label">Vibes</div>
              <div class="chips">
                @for (v of vibes; track v.id) {
                  <span class="chip">{{ v.name }}</span>
                }
              </div>
            </section>
          }
        }

        @if (collectionsFor(p.collectionIds); as cols) {
          @if (cols.length > 0) {
            <section class="block">
              <div class="label">Collections</div>
              <div class="chips">
                @for (c of cols; track c.id) {
                  <span class="chip"><i class="ti ti-folder"></i> {{ c.name }}</span>
                }
              </div>
            </section>
          }
        }

        <section class="block">
          <div class="label">Visits & notes</div>

          @if (facade.sortedVisits().length === 0 && !facade.addingVisit()) {
            <p class="empty">No visits logged yet.</p>
          }

          @for (v of facade.sortedVisits(); track v.id) {
            <div class="visit">
              <div class="visit-head">
                <span class="visit-rating" [class]="'r-' + v.rating">
                  {{ ratingEmoji(v.rating) }}
                </span>
                <span class="visit-date">{{ v.date | date: 'mediumDate' }}</span>
                <button
                  class="visit-del"
                  (click)="facade.deleteVisit(v.id)"
                  aria-label="Delete visit"
                >
                  ×
                </button>
              </div>
              @if (v.note) {
                <p class="visit-note">{{ v.note }}</p>
              }
            </div>
          }

          @if (facade.addingVisit()) {
            <div class="visit-form">
              <div class="rating-picker">
                <button
                  class="rate"
                  [class.sel]="facade.visitDraftRating() === 'thumbs-up'"
                  (click)="facade.setVisitRating('thumbs-up')"
                  aria-label="Thumbs up"
                >
                  👍
                </button>
                <button
                  class="rate"
                  [class.sel]="facade.visitDraftRating() === 'meh'"
                  (click)="facade.setVisitRating('meh')"
                  aria-label="Meh, not worth it"
                  title="Not worth it"
                >
                  😐
                </button>
                <button
                  class="rate"
                  [class.sel]="facade.visitDraftRating() === 'thumbs-down'"
                  (click)="facade.setVisitRating('thumbs-down')"
                  aria-label="Thumbs down"
                >
                  👎
                </button>
              </div>
              <input
                type="date"
                class="date-input"
                [ngModel]="facade.visitDraftDate()"
                (ngModelChange)="facade.visitDraftDate.set($event)"
              />
              <textarea
                class="note-input"
                [ngModel]="facade.visitDraftNote()"
                (ngModelChange)="facade.visitDraftNote.set($event)"
                placeholder="A line about how it went…"
                rows="2"
              ></textarea>
              <div class="visit-actions">
                <button class="link" (click)="facade.cancelAddVisit()">Cancel</button>
                <button
                  class="link primary"
                  [disabled]="!facade.visitDraftRating()"
                  (click)="facade.saveVisit()"
                >
                  Save visit
                </button>
              </div>
            </div>
          } @else {
            <button class="add-visit" (click)="facade.startAddVisit()">+ add visit</button>
          }
        </section>

        <section class="block actions-block">
          <!-- Split button: main click opens the smart default; chevron opens
               a popover with all variants for one-time override. -->
          <div class="action-split">
            <a
              class="action action-main"
              [href]="facade.googleMapsUrl()"
              target="_blank"
              rel="noopener"
            >
              Open in Google Maps <i class="ti ti-external-link"></i>
            </a>
            <button
              type="button"
              class="action action-chev"
              [class.on]="showMapsVariants()"
              (click)="toggleMapsVariants($event)"
              aria-label="Choose how to open in Google Maps"
              [attr.aria-expanded]="showMapsVariants()"
              aria-haspopup="menu"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2.5"
                stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            @if (showMapsVariants()) {
              <div class="maps-popover" role="menu" (click)="$event.stopPropagation()">
                <div class="maps-popover-head">Open with</div>
                @for (v of facade.mapsQueryVariants(); track v.key; let i = $index) {
                  <a
                    class="maps-variant"
                    role="menuitem"
                    [href]="v.url"
                    target="_blank"
                    rel="noopener"
                    (click)="onVariantPick()"
                  >
                    <div class="maps-variant-row">
                      <span class="maps-variant-label">{{ v.label }}</span>
                      @if (i === 0) {
                        <span class="maps-variant-default">default</span>
                      }
                    </div>
                    <div class="maps-variant-preview">{{ v.preview }}</div>
                  </a>
                }
              </div>
            }
          </div>

          <button class="action" (click)="onEdit()">Edit place</button>
        </section>
      }
    </aside>

    @if (showDelete()) {
      <wf-delete-confirm
        (confirmed)="onConfirmDelete()"
        (cancelled)="showDelete.set(false)"
      />
    }
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      /*
       * Transparent backdrop for outside-click-to-close.
       * Sits below the panel but above the rest of the app (topbar excluded
       * by using top: 64px to match panel offset). Click anywhere on it
       * commits pending edits and closes the panel.
       */
      .backdrop {
        position: fixed;
        top: 64px; /* below topbar */
        left: 240px; /* right of sidebar */
        right: 240px; /* left of panel */
        bottom: 0;
        z-index: 1400;
        background: transparent;
        cursor: pointer;
      }

      /*
       * Panel: sized to mirror the left sidebar — 240px wide, starts below
       * the topbar (top: 64px), spans to the bottom of the page. This keeps
       * the topbar Settings gear, brand area, and other top controls fully
       * clickable while the panel is open.
       */
      .panel {
        position: fixed;
        top: 64px;
        right: 0;
        bottom: 0;
        width: 240px;
        max-width: 100vw;
        background: var(--wf-bg);
        border-left: 0.5px solid var(--wf-hairline);
        box-shadow: -4px 0 16px color-mix(in srgb, var(--wf-ink) 8%, transparent);
        z-index: 1500;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow-y: auto;
        padding: 14px 14px 28px;
      }
      .panel.show {
        transform: translateX(0);
      }

      .hero {
        margin-bottom: 16px;
      }
      .name-row {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
      }
      .name {
        margin: 0;
        flex: 1;
        font-family: var(--wf-font-display);
        font-size: 18px;
        font-weight: 500;
        color: var(--wf-ink);
        line-height: 1.3;
        word-break: break-word;
      }
      .name-icons {
        display: inline-flex;
        gap: 2px;
        flex-shrink: 0;
        margin-top: 2px;
      }
      .row-icon {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        border: 0.5px solid var(--wf-hairline);
        background: transparent;
        color: var(--wf-ink-soft);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .row-icon i.ti {
        font-size: 13px;
      }
      .row-icon:hover {
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        border-color: var(--wf-ink-soft);
      }
      .row-icon.danger {
        color: var(--wf-accent);
        border-color: color-mix(in srgb, var(--wf-accent) 50%, transparent);
      }
      .row-icon.danger:hover {
        background: color-mix(in srgb, var(--wf-accent) 12%, transparent);
        color: var(--wf-accent);
        border-color: var(--wf-accent);
      }
      .row-icon.close {
        border-color: transparent;
      }
      .row-icon.close:hover {
        border-color: var(--wf-hairline);
      }

      .name-input {
        flex: 1;
        padding: 6px 10px;
        font-family: var(--wf-font-display);
        font-size: 16px;
        font-weight: 500;
        border-radius: 6px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
      }
      .name-input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .name-actions {
        display: flex;
        gap: 6px;
        margin-top: 6px;
      }

      .meta-row {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .cat-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        font-size: 11px;
        background: var(--wf-bg-2);
        border-radius: 12px;
      }
      .cat-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
      }
      .status-toggle {
        padding: 3px 8px;
        font-size: 11px;
        border-radius: 12px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink-soft);
        cursor: pointer;
      }
      .status-toggle.visited {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
      .fav-toggle {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink-faint);
        cursor: pointer;
        font-size: 11px;
      }
      .fav-toggle.on {
        background: var(--wf-gold);
        color: var(--wf-ink);
        border-color: var(--wf-gold);
      }

      .block {
        margin-bottom: 14px;
      }
      .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--wf-ink-faint);
        margin-bottom: 4px;
      }
      .addr {
        font-size: 12px;
        color: var(--wf-ink);
        line-height: 1.5;
        margin: 0 0 4px;
        word-break: break-word;
      }
      .coords {
        font-size: 11px;
        color: var(--wf-ink-soft);
        font-family: var(--wf-font-mono, monospace);
        margin: 0;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .chip {
        padding: 3px 8px;
        font-size: 11px;
        background: var(--wf-bg-2);
        border-radius: 10px;
        color: var(--wf-ink);
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .chip i.ti {
        font-size: 12px;
        color: var(--wf-ink-soft);
      }

      .empty {
        font-size: 12px;
        color: var(--wf-ink-faint);
        font-style: italic;
        margin: 4px 0;
      }
      .visit {
        background: var(--wf-bg-2);
        padding: 8px 10px;
        border-radius: 6px;
        margin-bottom: 6px;
      }
      .visit-head {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .visit-rating {
        font-size: 14px;
      }
      .visit-date {
        flex: 1;
        font-size: 11px;
        color: var(--wf-ink-soft);
      }
      .visit-del {
        background: none;
        border: none;
        font-size: 14px;
        color: var(--wf-ink-faint);
        cursor: pointer;
        padding: 0 4px;
      }
      .visit-del:hover {
        color: var(--wf-accent);
      }
      .visit-note {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--wf-ink);
        line-height: 1.4;
      }
      .visit-form {
        background: var(--wf-bg-2);
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 6px;
      }
      .rating-picker {
        display: flex;
        gap: 6px;
        margin-bottom: 8px;
      }
      .rate {
        flex: 1;
        padding: 8px;
        font-size: 18px;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 6px;
        cursor: pointer;
      }
      .rate.sel {
        background: var(--wf-ink);
        border-color: var(--wf-ink);
        transform: scale(1.05);
      }
      .date-input,
      .note-input {
        width: 100%;
        padding: 6px 8px;
        border-radius: 5px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg);
        font: inherit;
        font-size: 12px;
        color: var(--wf-ink);
      }
      .date-input {
        margin-bottom: 6px;
      }
      .note-input {
        resize: vertical;
      }
      .visit-actions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        margin-top: 8px;
      }
      .add-visit {
        background: none;
        border: 1px dashed var(--wf-hairline);
        color: var(--wf-ink-soft);
        padding: 8px;
        width: 100%;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
      }
      .add-visit:hover {
        border-color: var(--wf-accent);
        color: var(--wf-accent);
      }

      .actions-block {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .action {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px;
        border-radius: 8px;
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        border: 0.5px solid var(--wf-hairline);
        cursor: pointer;
        font-size: 12px;
        text-decoration: none;
        font-weight: 500;
      }
      .action i.ti {
        font-size: 12px;
      }
      .action:hover {
        background: var(--wf-bg);
        border-color: var(--wf-ink-soft);
      }

      /* ============ ADDRESS — name + address inline ============ */
      .addr-name {
        font-weight: 500;
        color: var(--wf-ink);
      }
      .addr-sep {
        color: var(--wf-ink-faint);
      }
      .addr-rest {
        color: var(--wf-ink-soft);
      }

      /* ============ SPLIT BUTTON: Open in Google Maps ============ */
      .action-split {
        position: relative;
        display: flex;
        gap: 0;
      }
      .action-main {
        flex: 1;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        border-right: none;
      }
      .action-chev {
        padding: 0 10px;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: var(--wf-ink-soft);
      }
      .action-chev:hover {
        color: var(--wf-ink);
      }
      .action-chev.on {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }

      /* ============ MAPS VARIANT POPOVER ============ */
      .maps-popover {
        position: absolute;
        bottom: calc(100% + 6px);
        right: 0;
        left: 0;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 10px;
        box-shadow:
          0 8px 24px rgba(0, 0, 0, 0.12),
          0 2px 6px rgba(0, 0, 0, 0.06);
        z-index: 1200;
        padding: 6px;
        max-height: 320px;
        overflow-y: auto;
      }
      .maps-popover-head {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--wf-ink-faint);
        padding: 6px 8px 4px;
        font-weight: 500;
      }
      .maps-variant {
        display: block;
        padding: 8px 10px;
        border-radius: 6px;
        text-decoration: none;
        color: var(--wf-ink);
        cursor: pointer;
        transition: background 0.12s ease;
      }
      .maps-variant:hover {
        background: var(--wf-bg-2);
      }
      .maps-variant-row {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 2px;
      }
      .maps-variant-label {
        font-size: 12px;
        font-weight: 500;
      }
      .maps-variant-default {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--wf-accent);
        background: color-mix(in srgb, var(--wf-accent) 12%, transparent);
        padding: 1px 5px;
        border-radius: 3px;
        font-weight: 500;
      }
      .maps-variant-preview {
        font-size: 11px;
        color: var(--wf-ink-soft);
        font-family: var(--wf-font-mono, ui-monospace, monospace);
        line-height: 1.35;
        word-break: break-word;
      }

      .link {
        background: none;
        border: none;
        font-size: 11px;
        color: var(--wf-ink-soft);
        cursor: pointer;
        padding: 4px 6px;
        font-weight: 500;
      }
      .link:hover {
        color: var(--wf-ink);
      }
      .link.primary {
        color: var(--wf-accent);
      }
      .link:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    `,
  ],
})
export class PlaceDetailComponent {
  protected facade = inject(PlaceDetailFacade);
  protected categoriesStore = inject(CategoriesStore);
  protected collectionsStore = inject(CollectionsStore);
  protected vibeTagsStore = inject(VibeTagsStore);

  readonly closed = output<void>();
  readonly editRequested = output<string>();

  protected showDelete = signal(false);

  /**
   * Whether the maps-variants popover is open. Closes on outside click, on
   * variant pick, on panel close, and on Escape.
   */
  protected showMapsVariants = signal(false);

  /** Public: parent calls this to open the detail panel for a place. */
  open(placeId: string): void {
    this.facade.open(placeId);
    this.showDelete.set(false);
    this.showMapsVariants.set(false);
  }

  /**
   * Public: parent reads this to know whether the panel is currently open.
   * Used by HomeComponent to hide the FAB and re-center the filter pill.
   */
  isOpen(): boolean {
    return this.facade.place() !== null;
  }

  protected onClose(): void {
    this.facade.close();
    this.showMapsVariants.set(false);
    this.closed.emit();
  }

  /**
   * Outside-click handler. Commits any pending name edit first (matches
   * typical "blur to confirm" UX) before closing the panel.
   */
  protected async onBackdropClick(): Promise<void> {
    await this.facade.commitPendingEdits();
    this.onClose();
  }

  protected onEdit(): void {
    const id = this.facade.placeId();
    if (id) this.editRequested.emit(id);
  }

  protected async onConfirmDelete(): Promise<void> {
    await this.facade.deletePlace();
    this.showDelete.set(false);
    this.closed.emit();
  }

  protected categoryFor(id: string) {
    return this.categoriesStore.entities().find((c) => c.id === id);
  }

  protected collectionsFor(ids: string[]) {
    return this.collectionsStore.entities().filter((c) => ids.includes(c.id));
  }

  protected vibeTags(ids: string[]) {
    return this.vibeTagsStore.entities().filter((v) => ids.includes(v.id));
  }

  protected ratingEmoji(rating: VisitRating | undefined): string {
    if (!rating) return '❓';
    switch (rating) {
      case 'thumbs-up':
        return '👍';
      case 'meh':
        return '😐';
      case 'thumbs-down':
        return '👎';
    }
  }

  /**
   * Toggle the maps-variant popover. stopPropagation so this click doesn't
   * immediately bubble up to the document click-outside handler below and
   * close the popover we just opened.
   */
  protected toggleMapsVariants(event: MouseEvent): void {
    event.stopPropagation();
    this.showMapsVariants.update((v) => !v);
  }

  /**
   * Click on a variant — the <a> tag itself opens Maps (target=_blank).
   * We just close the popover.
   */
  protected onVariantPick(): void {
    this.showMapsVariants.set(false);
  }

  /**
   * Document-level click handler. Closes the popover when clicking anywhere
   * outside the .action-split container. The popover's own click handler
   * stops propagation so clicks inside don't trigger this.
   */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.showMapsVariants()) {
      this.showMapsVariants.set(false);
    }
  }

  /** Escape closes the popover before anything else (e.g. before closing the panel). */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.showMapsVariants()) {
      this.showMapsVariants.set(false);
    }
  }
}