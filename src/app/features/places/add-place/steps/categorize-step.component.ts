import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { AddPlaceFacade } from '../add-place.facade';
import { CategoriesStore } from '../../../../core/stores/categories.store';
import { VibeTagsStore } from '../../../../core/stores/vibe-tags.store';

@Component({
  selector: 'wf-categorize-step',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3>What is this place?</h3>
    <p class="sub">Pick one category, then add any vibe tags.</p>

    <div class="label">Category</div>
    <div class="chips">
      @for (cat of sortedCategories(); track cat.id) {
        <button
          class="chip cat"
          [class.sel]="facade.categoryId() === cat.id"
          (click)="facade.categoryId.set(cat.id)"
        >
          <span class="sw" [style.background]="cat.color"></span>
          {{ cat.name }}
        </button>
      }
    </div>

    <div class="label">Vibe tags</div>
    <div class="chips">
      @for (tag of sortedVibeTags(); track tag.id) {
        <button
          class="chip"
          [class.sel]="facade.vibeTagIds().includes(tag.id)"
          (click)="facade.toggleVibeTag(tag.id)"
        >
          {{ tag.name }}
        </button>
      }
    </div>

    <div class="actions">
      <button class="btn" (click)="facade.goBack()">Back</button>
      <button
        class="btn primary"
        [disabled]="!facade.canContinueStep3()"
        (click)="facade.goNext()"
      >
        Continue
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
      }.chip {
        padding: 7px 12px;
        border-radius: var(--wf-radius-pill);
        background: var(--wf-bg-2);
        border: 0.5px solid var(--wf-hairline);
        color: var(--wf-ink);
        cursor: pointer;
        font-size: 12px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .chip:hover {
        border-color: var(--wf-accent);
      }
      .chip.sel {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
      .chip .sw {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
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
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn.primary {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
      .btn.primary:hover:not(:disabled) {
        background: var(--wf-accent);
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow-hover);
      }
    `,
  ],
})
export class CategorizeStepComponent {
  protected facade = inject(AddPlaceFacade);
  private categories = inject(CategoriesStore);
  private vibeTags = inject(VibeTagsStore);

  protected sortedCategories = computed(() =>
    [...this.categories.entities()]
      .filter((c) => !c.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  protected sortedVibeTags = computed(() =>
    [...this.vibeTags.entities()]
      .filter((v) => !v.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );
}