import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

export type EmptyStateVariant = 'no-places' | 'no-results';

@Component({
  selector: 'wf-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" [class]="variant()">
      @if (variant() === 'no-places') {
        <div class="icon">🧭</div>
        <h3>Your map is wide open.</h3>
        <p>Drop your first pin and start building your world.</p>
        <button class="cta" (click)="addPlace.emit()">+ Add a place</button>
      } @else {
        <div class="icon">🔍</div>
        <h3>No places match.</h3>
        <p>Try a different filter, or clear to see everything.</p>
        <button class="cta" (click)="clearFilters.emit()">Clear filters</button>
      }
    </div>
  `,
  styles: [
 `
      .empty {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        text-align: center;
        background: color-mix(in srgb, var(--wf-bg) 85%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 16px;
        padding: 32px 40px;
        max-width: 300px;
        box-shadow: 0 8px 24px color-mix(in srgb, var(--wf-ink) 10%, transparent);
        pointer-events: auto;
        z-index: 900;
      }
.icon {
        font-size: 40px;
        margin-bottom: 12px;
      }
      h3 {
        margin: 0 0 8px;
        font-family: var(--wf-font-display);
        font-size: 18px;
        font-weight: 500;
        color: var(--wf-ink);
      }
p {
        margin: 0 0 18px;
        font-size: 13px;
        color: var(--wf-ink-soft);
        line-height: 1.5;
      }
      .cta {
        padding: 10px 20px;
        background: var(--wf-ink);
        color: var(--wf-bg);
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
      }
.cta:hover {
        background: var(--wf-accent);
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly variant = input.required<EmptyStateVariant>();
  readonly addPlace = output<void>();
  readonly clearFilters = output<void>();
}
