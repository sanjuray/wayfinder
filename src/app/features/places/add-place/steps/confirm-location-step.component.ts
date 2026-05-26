import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AddPlaceFacade } from '../add-place.facade';

@Component({
  selector: 'wf-confirm-location-step',
  standalone: true,
  imports: [DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <p class="sub">Add a name to help you recognize this place later.</p>

    @if (facade.draft(); as d) {
      <div class="label">Name this place your way.</div>
      <input
        class="name-input"
        [ngModel]="facade.customName()"
        (ngModelChange)="facade.customName.set($event)"
        name="customName"
        placeholder="Give it a name you'll remember"
      />
      <div class="resolved">
        <svg class="loc-icon" width="32" height="36" viewBox="-6 -2 44 44">
          <circle cx="14" cy="34" r="10" fill="var(--wf-accent)" opacity="0.15" />
          <circle cx="14" cy="34" r="6" fill="var(--wf-accent)" opacity="0.25" />
          <path
            d="M14 2 C7 2 2 7 2 14 C2 23 14 34 14 34 C14 34 26 23 26 14 C26 7 21 2 14 2 Z"
            fill="var(--wf-accent)"
            stroke="var(--wf-accent)"
            stroke-width="2"
          />
          <circle cx="14" cy="14" r="3.5" fill="var(--wf-bg)" />
        </svg>
        <div class="details">
          @if (d.displayAddress) {
            <div class="addr">
              {{ d.displayAddress || d.name}}
            </div>
          }
          <div class="coords">
            {{ d.lat | number: '1.4-4' }}°N, {{ d.lng | number: '1.4-4' }}°E
          </div>
        </div>
      </div>
    }
    <p class="help">If the pin's slightly off, drag it on the map to nudge.</p>

    <div class="actions">
      <button class="btn" (click)="facade.goBack()">Back</button>
      <button
        class="btn primary"
        [disabled]="!facade.canContinueStep2()"
        (click)="facade.goNext()"
      >
        Looks right
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
        letter-spacing: 0.8px;
        color: var(--wf-ink-faint);
        margin: 4px 0 6px;
      }
      .name-input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        font: inherit;
        font-weight: 500;
        color: var(--wf-ink);
        margin-bottom: 12px;
      }
      .name-input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .resolved {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        padding: 14px;
        background: var(--wf-bg-2);
        border-radius: 10px;
        margin-bottom: 14px;
      }
      .loc-icon {
        flex-shrink: 0;
        margin-top: 2px;
      }
      .details {
        flex: 1;
        min-width: 0;
      }
      .addr {
        font-size: 13px;
        color: var(--wf-ink);
        line-height: 1.5;
        word-break: break-word;
        margin-bottom: 4px;
      }
      .coords {
        font-size: 12px;
        color: var(--wf-ink-soft);
        font-family: var(--wf-font-mono, monospace);
      }
      .help {
        font-size: 12px;
        color: var(--wf-ink-faint);
        margin: 8px 0 0;
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
      .btn.primary:hover {
        background: var(--wf-accent);
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow-hover);
      }
    `,
  ],
})
export class ConfirmLocationStepComponent {
  protected facade = inject(AddPlaceFacade);
}
