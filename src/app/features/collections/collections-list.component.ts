import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'wf-collections-list',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="head">
        <a routerLink="/" class="back">← back to map</a>
        <h1>Collections</h1>
      </header>
      <div class="placeholder">
        <p>Collections detail and management coming in the next phase.</p>
        <p class="hint">For now, click a collection in the sidebar to filter the map.</p>
      </div>
    </div>
  `,
  styles: [`
    .page { height: 100vh; background: var(--wf-bg); }
    .head {
      display: flex; align-items: center; gap: 16px;
      padding: 14px 22px;
      border-bottom: 0.5px solid var(--wf-hairline);
    }
    .back {
      color: var(--wf-ink-soft); text-decoration: none; font-size: 13px;
      padding: 6px 10px; border-radius: 8px;
    }
    .back:hover { background: var(--wf-hairline); color: var(--wf-ink); }
    h1 {
      margin: 0;
      font-family: var(--wf-font-display);
      font-size: 20px; font-weight: 500; color: var(--wf-ink);
    }
    .placeholder {
      max-width: 480px; margin: 80px auto;
      text-align: center; color: var(--wf-ink-soft);
    }
    .placeholder p { font-size: 14px; line-height: 1.6; margin: 0 0 8px; }
    .hint { font-size: 12px; color: var(--wf-ink-faint); font-style: italic; }
  `],
})
export class CollectionsListComponent {}