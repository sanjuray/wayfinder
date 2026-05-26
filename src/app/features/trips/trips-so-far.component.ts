import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TripsStore } from '../../core/stores/trips.store';

/**
 * Phase 6 placeholder. Real list view lands when Phase 6 starts.
 * Renders inside WorkspaceShellComponent.
 */
@Component({
  selector: 'wf-trips-so-far',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="head">
        <h1>Trips so far</h1>
        <p class="meta">
          {{ trips.entities().length }} total · {{ trips.upcoming().length }} upcoming
        </p>
      </header>
      <div class="placeholder">
        <p>Trips list view — coming in Phase 6.</p>
      </div>
    </div>
  `,
  styles: [`
    .page { height: 100%; background: var(--wf-bg); padding: 24px 28px; overflow-y: auto; }
    .head { margin-bottom: 24px; }
    h1 {
      margin: 0;
      font-family: var(--wf-font-display);
      font-size: 28px; font-weight: 500;
      letter-spacing: -0.4px;
      color: var(--wf-ink);
    }
    .meta { font-size: 13px; color: var(--wf-ink-soft); margin: 6px 0 0; }
    .placeholder {
      max-width: 480px; margin: 60px auto;
      text-align: center; color: var(--wf-ink-soft);
    }
    .placeholder p { font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
  `],
})
export class TripsSoFarComponent {
  protected trips = inject(TripsStore);
}