import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Phase 4 placeholder. Real list view (collection cards grid) lands when Phase 4
 * proper starts. For now: renders inside WorkspaceShellComponent so the topbar
 * stays visible.
 */
@Component({
  selector: 'wf-collections-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="head">
        <h1>Collections</h1>
      </header>
      <div class="placeholder">
        <p>Collections list view — coming in Phase 4.</p>
        <p class="hint">For now, click a collection in the map sidebar to filter pins.</p>
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
    .placeholder {
      max-width: 480px; margin: 60px auto;
      text-align: center; color: var(--wf-ink-soft);
    }
    .placeholder p { font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
    .hint { font-size: 12px; color: var(--wf-ink-faint); font-style: italic; }
  `],
})
export class CollectionsListComponent {}