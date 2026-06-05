import {
  Component,
  inject,
  output,
  input,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

const CONFIRM_PHRASE = 'let it go';

/**
 * "Let it go" typed-confirmation modal. Used by:
 *   - features/places/place-detail  (single place delete)
 *   - features/places/places-list   (bulk delete; passes `count` input)
 *
 * When `count` is omitted or 1, the copy is the singular form. When `count`
 * is >1, the heading says "Letting go of N places is hard." — same vibe,
 * just inflected.
 */
@Component({
  selector: 'wf-delete-confirm',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="onCancel()"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <h3 id="delete-title">
        @if (count() > 1) {
          Letting go of {{ count() }} places is hard.
        } @else {
          Letting go is hard.
        }
      </h3>
      <p class="body">
        @if (count() > 1) {
          Holding on to {{ count() }} places that aren't for you is harder.
          Let them go.
        } @else {
          Holding on to a place that's not for you is harder. Let it go.
        }
      </p>
      <p class="instruction">
        Type <strong>let it go</strong> to confirm.
      </p>
      <input
        class="input"
        [ngModel]="typed()"
        (ngModelChange)="typed.set($event)"
        placeholder="let it go"
        autofocus
      />
      <div class="actions">
        <button class="btn" (click)="onCancel()">Cancel</button>
        <button
          class="btn danger"
          [disabled]="!canConfirm()"
          (click)="onConfirm()"
        >
          Let it go
        </button>
      </div>
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
        padding: 24px;
        width: 360px;
        max-width: calc(100vw - 32px);
        box-shadow: 0 24px 48px color-mix(in srgb, var(--wf-ink) 35%, transparent);
      }
      h3 {
        margin: 0 0 10px;
        font-family: var(--wf-font-display);
        font-size: 20px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .body {
        font-size: 14px;
        line-height: 1.5;
        color: var(--wf-ink-soft);
        margin: 0 0 16px;
      }
      .instruction {
        font-size: 12px;
        color: var(--wf-ink-faint);
        margin: 0 0 10px;
      }
      .instruction strong {
        color: var(--wf-ink);
        font-weight: 600;
        font-family: var(--wf-font-mono, monospace);
      }
      .input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        font: inherit;
        color: var(--wf-ink);
        margin-bottom: 16px;
      }
      .input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      .btn {
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 500;
        border-radius: 10px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        cursor: pointer;
      }
      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .btn.danger {
        background: var(--wf-accent);
        color: var(--wf-bg);
        border-color: var(--wf-accent);
      }
    `,
  ],
})
export class DeleteConfirmComponent {
  /**
   * How many places this confirm affects. Defaults to 1 — the single-place
   * delete from place-detail doesn't need to pass anything, so existing
   * callers keep working unchanged.
   */
  readonly count = input<number>(1);

  protected typed = signal('');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected canConfirm = computed(
    () => this.typed().trim().toLowerCase() === CONFIRM_PHRASE
  );

  onConfirm(): void {
    if (this.canConfirm()) this.confirmed.emit();
  }
  onCancel(): void {
    this.cancelled.emit();
  }
}