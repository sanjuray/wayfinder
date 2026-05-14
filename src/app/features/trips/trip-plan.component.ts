import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'wf-trip-plan',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/trips" class="back">← trips so far</a>
      <h1>Trip plan</h1>
      <p>Trip ID: {{ id() }}</p>
      <p class="todo">TODO: trip detail view per spec section 5.6.</p>
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
        margin: 16px 0;
      }
      .todo {
        color: var(--wf-ink-faint);
        font-style: italic;
      }
    `,
  ],
})
export class TripPlanComponent {
  readonly id = input<string>('');
}