import { Component, inject, computed, output, ChangeDetectionStrategy } from '@angular/core';
import { AddPlaceFacade } from '../add-place.facade';
import { CollectionsStore } from '../../../../core/stores/collections.store';

@Component({
  selector: 'wf-save-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3>Save it where?</h3>
    <p class="sub">Drop into one or many collections — or none.</p>

    <div class="label">Collections</div>
    <div class="chips">
      @if (sortedCollections().length === 0) {
        <span class="hint">No collections yet. You can add this without one.</span>
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
      <button class="btn primary" (click)="save.emit()">✦ Drop pin</button>
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
      }
      .chip.sel {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
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
  readonly save = output<void>();

  protected sortedCollections = computed(() =>
    [...this.collections.entities()].sort((a, b) => a.name.localeCompare(b.name))
  );
}