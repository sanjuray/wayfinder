import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Phase 4 placeholder. Real detail view (header + place list + map) lands when
 * Phase 4 proper starts. Renders inside WorkspaceShellComponent.
 */
@Component({
  selector: 'wf-collection-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="head">
        <a routerLink="/collections" class="back">← Collections</a>
        <h1>Collection</h1>
      </header>
      <div class="placeholder">
        <p>Collection ID: <code>{{ id() }}</code></p>
        <p class="hint">Detail view coming in Phase 4.</p>
      </div>
    </div>
  `,
  styles: [`
    .page { height: 100%; background: var(--wf-bg); padding: 24px 28px; overflow-y: auto; }
    .head { margin-bottom: 24px; display: flex; flex-direction: column; gap: 6px; }
    .back {
      align-self: flex-start;
      font-size: 12px; color: var(--wf-ink-soft); text-decoration: none;
      padding: 4px 8px; border-radius: 6px; margin-left: -8px;
    }
    .back:hover { background: var(--wf-hairline); color: var(--wf-ink); }
    h1 {
      margin: 0;
      font-family: var(--wf-font-display);
      font-size: 26px; font-weight: 500;
      letter-spacing: -0.4px;
      color: var(--wf-ink);
    }
    .placeholder {
      max-width: 480px; margin: 60px auto;
      text-align: center; color: var(--wf-ink-soft);
    }
    .placeholder p { font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
    code { background: var(--wf-bg-2); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .hint { font-size: 12px; color: var(--wf-ink-faint); font-style: italic; }
  `],
})
export class CollectionDetailComponent {
  id = input.required<string>();
}