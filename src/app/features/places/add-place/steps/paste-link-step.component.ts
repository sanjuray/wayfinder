import { Component, inject, output, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddPlaceFacade } from '../add-place.facade';

@Component({
  selector: 'wf-paste-link-step',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- <h3>Drop a new place</h3> -->
    <h2>{{ facade.isEditMode() ? 'Edit place' : 'Drop a new place' }}</h2>
    <p class="sub">Where do you want to remember?</p>

    <input
      class="input"
      [ngModel]="facade.inputText()"
      (ngModelChange)="facade.inputText.set($event)"
      name="placeInput"
      placeholder="maps.app.goo.gl/… or paste any address"
      autofocus
    />  
    <p class="help">
      Google Maps links resolve automatically. For reels or shorts, paste the caption or address.
      Or close this and click any where on the map.<br/>
      (!) -> Address with Geocode like: 'GFJ8+M6C, Village, State Pincode' will resolve in lower precision
    </p>

    @if (facade.error(); as err) {
      <p class="error">{{ err }}</p>
    }

    <div class="actions">
      <button class="btn" (click)="cancelled.emit()">Cancel</button>
      <button
        class="btn primary"
        [disabled]="!facade.canContinueStep1() || facade.loading()"
        (click)="facade.resolveInput()"
      >
        @if (facade.loading()) {
          Resolving…
        } @else {
          Continue
        }
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
      .input {
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        font: inherit;
        color: var(--wf-ink);
        margin-bottom: 10px;
      }
      .input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .help {
        font-size: 12px;
        color: var(--wf-ink-faint);
        line-height: 1.6;
      }
        .error {
        font-size: 13px;
        color: #a32d2d;
        margin: 8px 0;
        padding: 8px 10px;
        background: rgba(163, 45, 45, 0.08);
        border-radius: 6px;
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
export class PasteLinkStepComponent {
  protected facade = inject(AddPlaceFacade);
  readonly cancelled = output<void>();
}