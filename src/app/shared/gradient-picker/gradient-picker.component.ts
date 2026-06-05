import {
  Component,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { GRADIENT_PALETTE, gradientCss } from '../../core/constants/collection-covers';
import type { CollectionCoverGradient } from '../../core/models';

/**
 * Pick a gradient preset for a collection cover.
 *
 * Mirrors the icon-picker pattern: modal with backdrop, two-step
 * highlight-then-confirm flow, `picked` + `cancelled` outputs. Much simpler
 * than the icon picker because the palette is a fixed 8 — no search, no
 * virtual scrolling, no library load.
 *
 * v2 will add custom hex-pair input. For v1 the 8 presets in
 * `core/constants/collection-covers.ts` are the entire vocabulary.
 */
@Component({
  selector: 'wf-gradient-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="onCancel()"></div>
    <div class="picker" role="dialog" aria-modal="true" aria-label="Pick a gradient">
      <header class="head">
        <h3>Pick a gradient</h3>
        <button class="close" (click)="onCancel()" aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>

      <div class="grid">
        @for (g of palette; track g.id) {
          <button
            class="swatch"
            [class.selected]="g.id === selected()"
            [style.background]="cssFor(g.id)"
            (click)="onPick(g.id)"
            [attr.aria-label]="g.name"
            [title]="g.name"
          >
            <span class="swatch-label">{{ g.name }}</span>
          </button>
        }
      </div>

      <footer class="foot">
        <button class="btn" (click)="onCancel()">Cancel</button>
        <button
          class="btn primary"
          [disabled]="!selected()"
          (click)="onConfirm()"
        >
          Use this gradient
        </button>
      </footer>
    </div>
  `,
  styles: [`
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
      background: color-mix(in srgb, var(--wf-ink) 35%, transparent);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .picker {
      position: relative;
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: 16px;
      width: 480px;
      max-width: calc(100vw - 32px);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 48px color-mix(in srgb, var(--wf-ink) 30%, transparent);
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 12px;
    }
    .head h3 {
      margin: 0;
      font-family: var(--wf-font-display);
      font-size: 18px;
      font-weight: 500;
      color: var(--wf-ink);
    }
    .close {
      background: transparent;
      border: none;
      color: var(--wf-ink-soft);
      cursor: pointer;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .close:hover {
      background: var(--wf-hairline);
      color: var(--wf-ink);
    }

    .grid {
      flex: 1;
      overflow-y: auto;
      padding: 4px 20px 20px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .swatch {
      aspect-ratio: 1;
      border-radius: 12px;
      border: 2px solid transparent;
      cursor: pointer;
      position: relative;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      overflow: hidden;
      padding: 0;
    }
    .swatch:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px color-mix(in srgb, var(--wf-ink) 20%, transparent);
    }
    .swatch.selected {
      border-color: var(--wf-ink);
      box-shadow:
        0 0 0 3px var(--wf-bg),
        0 0 0 5px var(--wf-ink);
    }
    .swatch-label {
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      font-family: var(--wf-font-display);
      font-size: 12px;
      font-weight: 500;
      color: white;
      text-align: left;
      letter-spacing: 0.2px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px 16px;
      border-top: 0.5px solid var(--wf-hairline);
    }
    .btn {
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 10px;
      border: 0.5px solid var(--wf-hairline);
      background: var(--wf-bg-2);
      color: var(--wf-ink);
      cursor: pointer;
      font-family: inherit;
    }
    .btn:disabled {
      opacity: 0.4;
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
    }
  `],
})
export class GradientPickerComponent {
  /**
   * Optional starting selection. Pre-highlights the currently-applied gradient
   * when the picker is opened from the collection editor.
   */
  readonly initial = input<CollectionCoverGradient | undefined>(undefined);

  readonly picked = output<CollectionCoverGradient>();
  readonly cancelled = output<void>();

  protected palette = GRADIENT_PALETTE;

  /** Currently-highlighted preset id. Pre-filled from `initial` on first render. */
  protected selected = signal<CollectionCoverGradient | null>(null);

  constructor() {
    // Seed the selection from the initial input so the user's current
    // gradient is highlighted on open. Reading input() synchronously here
    // is safe — required inputs are set before the constructor runs.
    const init = this.initial();
    if (init) this.selected.set(init);
  }

  protected cssFor(id: CollectionCoverGradient): string {
    return gradientCss(id);
  }

  protected onPick(id: CollectionCoverGradient): void {
    this.selected.set(id);
  }

  protected onConfirm(): void {
    const id = this.selected();
    if (id) this.picked.emit(id);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}