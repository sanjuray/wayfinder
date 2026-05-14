import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripsStore } from '../../core/stores/trips.store';

@Component({
  selector: 'wf-trips-so-far',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/" class="back">← back to map</a>
      <h1>Trips so far</h1>
      <p class="meta">
        {{ trips.entities().length }} total · {{ trips.upcoming().length }} upcoming
      </p>
      <p class="todo">TODO: trips list view per spec section 5.5.</p>
    </div>
  `,
  styles: [
    `
      .page {
        padding: 32px;
        color: var(--wf-ink);
      }
      .back {
        font-size: 13px;
        color: var(--wf-ink-soft);
        text-decoration: none;
      }
      h1 {
        font-family: var(--wf-font-display);
        margin: 16px 0 4px;
      }
      .meta {
        font-size: 13px;
        color: var(--wf-ink-soft);
      }
      .todo {
        color: var(--wf-ink-faint);
        font-style: italic;
        margin-top: 24px;
      }
    `,
  ],
})
export class TripsSoFarComponent {
  protected trips = inject(TripsStore);
}