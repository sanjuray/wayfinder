import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppStateStore } from '../../core/stores/app-state.store';
import { ThemeService } from '../../core/services/theme.service';
import { THEME_NAMES, type ThemeName } from '../../core/models';

@Component({
  selector: 'wf-settings',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/" class="back">← back to map</a>
      <h1>Settings</h1>

      <section>
        <h2>Theme</h2>
        <p class="meta">Seven themes. Switch any time — the whole app re-renders live.</p>
        <div class="theme-grid">
          @for (t of themes; track t) {
            <button
              class="theme-tile"
              [class.active]="appState.themePreference() === t"
              (click)="setTheme(t)"
            >
              <span class="theme-name">{{ t }}</span>
            </button>
          }
        </div>
      </section>

      <section>
        <h2>About</h2>
        <p class="about-lead">Wayfinder is for everyone in between.</p>
        <p class="about-body">
          For the enthusiastic and the lazy. For ambitious visionary planners and the hard-to-move
          homebodies with glimpses of hope. For the seasoned wanderer and the once-in-a-while
          explorer. For anyone collecting places they mean to go.
        </p>
        <p class="about-body">
          Wayfinder doesn't push. It pins. It plans. It taunts when you need it, encourages when
          you don't, and stays quiet when you just want to look at the map.
        </p>
        <p class="about-body">Built for fellow travelers — hoping this helps in your journey.</p>
        <p class="about-fine">Made with care. No servers. No ads. No telemetry.</p>
      </section>

      <p class="todo">TODO: full settings per spec section 5.8.</p>
    </div>
  `,
  styles: [
    `
      .page {
        padding: 32px;
        max-width: 720px;
        margin: 0 auto;
        color: var(--wf-ink);
      }
      .back {
        font-size: 13px;
        color: var(--wf-ink-soft);
        text-decoration: none;
      }
      h1 {
        font-family: var(--wf-font-display);
        margin: 16px 0 24px;
      }
      h2 {
        font-family: var(--wf-font-display);
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 8px;
      }
        section {
        margin-bottom: 32px;
        padding: 24px;
        border-radius: var(--wf-radius-card);
        background: var(--wf-bg-2);
      }
      .meta {
        font-size: 13px;
        color: var(--wf-ink-soft);
        margin-bottom: 16px;
      }
      .theme-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
      }
      .theme-tile {
        padding: 16px 14px;
        background: var(--wf-bg);
        border: 0.5px solid var(--wf-hairline);
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        text-transform: capitalize;
      }
      .theme-tile.active {
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .theme-name {
        font-size: 14px;
        font-weight: 500;
      }
        about-lead {
        font-family: var(--wf-font-display);
        font-size: 18px;
        font-weight: 500;
        margin-bottom: 14px;
      }
      .about-body {
        font-size: 13px;
        line-height: 1.7;
        color: var(--wf-ink-soft);
        margin-bottom: 12px;
      }
      .about-fine {
        font-size: 11px;
        color: var(--wf-ink-faint);
        font-style: italic;
        padding-top: 14px;
        border-top: 0.5px solid var(--wf-hairline-soft);
      }
      .todo {
        color: var(--wf-ink-faint);
        font-style: italic;
        margin-top: 24px;
      }
    `,
  ],
})
export class SettingsComponent {
  protected appState = inject(AppStateStore);
  private themeService = inject(ThemeService);
  protected themes = THEME_NAMES;

  async setTheme(theme: ThemeName): Promise<void> {
    await this.appState.setTheme(theme);
    this.themeService.apply(theme);
  }
}