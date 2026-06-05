import {
  Component,
  inject,
  computed,
  signal,
  output,
  afterNextRender,
  Injector,
  ViewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddPlaceFacade } from '../add-place.facade';
import { CollectionsStore } from '../../../../core/stores/collections.store';

/**
 * Step 4 of the add-place flow: pick collections, set status, mark favorite,
 * confirm save.
 *
 * Phase 4 (d) addition: trailing "+ New" chip that expands into an inline
 * input. Type a name → Enter → new collection is created, auto-selected,
 * and the chip collapses back. No modal, no popover — same row as the
 * other collection chips.
 */
@Component({
  selector: 'wf-save-step',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3>Save it where?</h3>
    <p class="sub">Drop into one or many collections — or none.</p>

    <div class="label">Collections</div>
    <div class="chips">
      @if (sortedCollections().length === 0 && !creatingNew()) {
        <span class="hint">No collections yet. You can add this without one — or create one below.</span>
      }
      @for (col of sortedCollections(); track col.id) {
        <button
          class="chip"
          [class.sel]="facade.collectionIds().includes(col.id)"
          (click)="facade.toggleCollection(col.id)"
        >
          📁 {{ col.name }}
        </button>
      }

      <!-- Phase 4 (d): inline create -->
      @if (creatingNew()) {
        <span class="chip chip-create">
          <i class="ti ti-folder-plus chip-icon"></i>
          <input
            #newInput
            class="chip-input"
            type="text"
            maxlength="60"
            placeholder="Collection name"
            [ngModel]="newName()"
            (ngModelChange)="newName.set($event)"
            (keydown.enter)="confirmCreate()"
            (keydown.escape)="cancelCreate()"
            (blur)="onBlurInput()"
            [disabled]="busy()"
          />
          @if (busy()) {
            <span class="chip-spinner"></span>
          }
        </span>
      } @else {
        <button class="chip chip-new" (click)="startCreate()" type="button">
          + New
        </button>
      }
    </div>

    <div class="label">Status</div>
    <div class="chips">
      <button
        class="chip"
        [class.sel]="facade.status() === 'planned'"
        (click)="facade.status.set('planned')"
      >
        planned
      </button>
      <button
        class="chip"
        [class.sel]="facade.status() === 'visited'"
        (click)="facade.status.set('visited')"
      >
        visited
      </button>
    </div>

    <div class="label">Mark as favorite</div>
    <div class="chips">
      <button
        class="chip"
        [class.sel]="facade.isFavorite()"
        (click)="facade.isFavorite.update((v) => !v)"
      >
        ✦ compass star
      </button>
    </div>

    <div class="actions">
      <button class="btn" (click)="facade.goBack()">Back</button>
      <button class="btn primary" (click)="save.emit()">
        {{ facade.isEditMode() ? 'Save changes' : '✦ Drop pin' }}
      </button>
    </div>
  `,
  styles: [
    `
      h3 {
        margin: 0 0 6px;
        font-family: var(--wf-font-display);
        font-size: 22px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .sub {
        font-size: 13px;
        color: var(--wf-ink-soft);
        margin: 0 0 16px;
      }
      .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: var(--wf-ink-faint);
        margin: 14px 0 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }
      .hint {
        font-size: 12px;
        color: var(--wf-ink-faint);
        font-style: italic;
      }
      .chip {
        padding: 7px 12px;
        border-radius: var(--wf-radius-pill);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        color: var(--wf-ink);
        cursor: pointer;
        font-size: 12px;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .chip.sel {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
      /* "+ New" chip — slightly less prominent */
      .chip-new {
        color: var(--wf-ink-soft);
        border-style: dashed;
        background: transparent;
      }
      .chip-new:hover {
        color: var(--wf-ink);
        border-color: var(--wf-ink-soft);
        background: var(--wf-bg-2);
      }
      /* Expanded inline-create chip */
      .chip-create {
        background: var(--wf-bg);
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
        padding: 4px 10px;
        cursor: default;
      }
      .chip-icon {
        color: var(--wf-accent);
        font-size: 13px;
      }
      .chip-input {
        background: transparent;
        border: none;
        outline: none;
        font: inherit;
        font-size: 12px;
        color: var(--wf-ink);
        width: 140px;
        padding: 3px 0;
      }
      .chip-input::placeholder {
        color: var(--wf-ink-faint);
      }
      .chip-input:disabled {
        opacity: 0.6;
      }
      .chip-spinner {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1.5px solid var(--wf-hairline);
        border-top-color: var(--wf-accent);
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
      }
      .btn {
        padding: 10px 18px;
        border-radius: 10px;
        font-size: 13px;
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
      .btn.primary:hover {
        background: var(--wf-accent);
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow-hover);
      }
    `,
  ],
})
export class SaveStepComponent {
  protected facade = inject(AddPlaceFacade);
  private collections = inject(CollectionsStore);
  private injector = inject(Injector);

  readonly save = output<void>();

  @ViewChild('newInput', { static: false })
  private newInputRef?: ElementRef<HTMLInputElement>;

  // ----- inline-create state -----
  protected creatingNew = signal(false);
  protected newName = signal('');
  protected busy = signal(false);
  /** Suppresses the blur→cancel race on Enter. */
  private justSubmitted = false;

  protected sortedCollections = computed(() =>
    [...this.collections.entities()].sort((a, b) => a.name.localeCompare(b.name))
  );

  protected startCreate(): void {
    this.creatingNew.set(true);
    this.newName.set('');
    this.justSubmitted = false;
    afterNextRender(
      () => this.newInputRef?.nativeElement.focus(),
      { injector: this.injector }
    );
  }

  protected cancelCreate(): void {
    this.creatingNew.set(false);
    this.newName.set('');
  }

  protected async confirmCreate(): Promise<void> {
    const name = this.newName().trim();
    if (!name || this.busy()) return;

    this.busy.set(true);
    this.justSubmitted = true;
    try {
      await this.facade.newCollection(name);
      this.newName.set('');
      this.creatingNew.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Blur on the inline input commits the name if non-empty (matching how
   * macOS Finder commits rename on blur). Avoids the double-action when
   * the user just hit Enter — Enter triggers confirmCreate which sets
   * justSubmitted, and the resulting blur is a no-op.
   */
  protected onBlurInput(): void {
    if (this.justSubmitted) {
      this.justSubmitted = false;
      return;
    }
    const name = this.newName().trim();
    if (name) {
      this.confirmCreate();
    } else {
      this.cancelCreate();
    }
  }
}