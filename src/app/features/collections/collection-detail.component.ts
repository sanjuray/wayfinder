import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'wf-collection-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/" class="back">← back to map</a>
      <h1>Collection</h1>
      <p>Collection ID: {{ id() }}</p>
      <p class="todo">TODO: collection detail view per spec section 5.4.</p>
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
export class CollectionDetailComponent {
  readonly id = input<string>('');
}