import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AddPlaceFacade } from '../add-place.facade';

@Component({
  selector: 'wf-confirm-location-step',
  standalone: true,
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3>Confirm location</h3>
    <p class="sub">Resolved from your link. Looks right?</p>

    @if (facade.draft(); as d) {
      <div class="resolved">
        <div class="pin"></div>
        <div>
          <div class="nm">{{ d.name }}</div>
          <div class="ad">
            {{ d.locality
            }}{{ d.region ? ', ' + d.region : ''
            }}{{ d.country ? ', ' + d.country : '' }}
            <br />
            {{ d.lat | number: '1.4-4' }}°N, {{ d.lng | number: '1.4-4' }}°E
          </div>
        </div>
      </div>
    }

    <p class="help">If the pin's slightly off, drag it on the map to nudge.</p>

    <div class="actions">
      <button class="btn" (click)="facade.goBack()">Back</button>
      <button class="btn primary" (click)="facade.goNext()">Looks right</button>
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
      .resolved {
        display: flex;
        gap: 14px;
        align-items: flex-start;
        padding: 14px;
        background: var(--wf-bg-2);
        border-radius: 10px;
        margin-bottom: 14px;
      }
      .resolved .pin {
        width: 16px;
        height: 20px;
        background: var(--wf-accent);
        border-radius: var(--wf-pin-shape);
        transform: rotate(-45deg);
        margin-top: 4px;
        flex-shrink: 0;
      }
        resolved .nm {
        font-weight: 500;
        font-size: 14px;
        color: var(--wf-ink);
      }
      .resolved .ad {
        font-size: 12px;
        color: var(--wf-ink-soft);
        margin-top: 2px;
        line-height: 1.5;
      }
      .help {
        font-size: 12px;
        color: var(--wf-ink-faint);
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
export class ConfirmLocationStepComponent {
  protected facade = inject(AddPlaceFacade);
}
