import { Component, inject, signal, ChangeDetectionStrategy, HostListener, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ScoutStateService } from './scout-state.service';
import { ScoutHistoryStore } from '../../core/stores/scout-history.store';
import { ScoutThreadComponent } from './scout-thread.component';
import { ScoutHistoryPanelComponent } from './scout-history-panel.component';
 
/**
 * Fullscreen Scout — the /scout route. On wide screens it's a two-pane layout:
 * a history sidebar on the left, the conversation on the right. On narrow
 * screens the sidebar collapses and a toggle switches between history and the
 * active conversation.
 *
 * Selecting a result routes back to the map with the place opened. Escape
 * returns to the map (matching the app's Escape-closes convention).
 */
@Component({
  selector: 'wf-scout-fullscreen',
  standalone: true,
  imports: [ScoutThreadComponent, ScoutHistoryPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scout-page">
      <header class="page-head">
        <button class="back" (click)="goBack()" aria-label="Back to map">←</button>
        <div class="brand">
          <span class="mark" aria-hidden="true">◇</span>
          <div class="brand-text">
            <span class="name">Scout</span>
            <span class="tagline">you command, i materialize</span>
          </div>
        </div>
        <div class="head-actions">
          <button class="pill" (click)="startNew()" aria-label="New conversation">＋ New</button>
          <button class="pill mobile-only" [class.active]="mobileShowHistory()" (click)="toggleMobileHistory()" aria-label="Toggle history">History</button>
        </div>
      </header>
 
      <div class="page-body">
        <aside class="sidebar" [class.mobile-hidden]="!mobileShowHistory()">
          <wf-scout-history-panel (opened)="onReopened()" />
        </aside>
        <section class="conversation" [class.mobile-hidden]="mobileShowHistory()">
          <wf-scout-thread [closeOnSelect]="false" />
        </section>
      </div>
    </div>
  `,
  styles: [`
    .scout-page { display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--wf-bg); }
    .page-head {
      flex: 0 0 auto;
      display: flex; align-items: center; gap: 14px;
      padding: 14px 22px;
      border-bottom: 0.5px solid var(--wf-hairline);
    }
    .back {
      width: var(--wf-touch, 44px); height: var(--wf-touch, 44px);
      display: grid; place-items: center;
      background: transparent; border: 0.5px solid var(--wf-hairline);
      border-radius: 10px; cursor: pointer;
      color: var(--wf-ink); font-size: 18px;
      transition: background .12s;
    }
    .back:hover { background: var(--wf-bg-2); }
    .back:focus-visible { outline: none; box-shadow: var(--wf-ring); }
    .brand { display: flex; align-items: center; gap: 12px; flex: 1; }
    .brand .mark { color: var(--wf-accent); font-size: 22px; }
    .brand-text { display: flex; flex-direction: column; }
    .brand .name { font-family: var(--wf-font-display); font-size: 18px; font-weight: 700; color: var(--wf-ink); line-height: 1.1; }
    .brand .tagline { font-family: var(--wf-font-handwrite, var(--wf-font-display)); font-size: 13px; color: var(--wf-ink-soft); }
    .head-actions { display: flex; gap: 8px; }
    .pill {
      font-size: 13px; color: var(--wf-ink-soft);
      background: transparent; border: 0.5px solid var(--wf-hairline);
      border-radius: var(--wf-radius-pill, 999px);
      padding: 8px 14px; min-height: var(--wf-touch, 44px); cursor: pointer;
      transition: border-color .15s, color .15s;
    }
    .pill:hover { border-color: var(--wf-accent); color: var(--wf-ink); }
    .pill:focus-visible { outline: none; box-shadow: var(--wf-ring); }
    .pill.active { border-color: var(--wf-accent); color: var(--wf-ink); }
 
    .page-body { flex: 1; min-height: 0; display: flex; }
    .sidebar {
      flex: 0 0 300px;
      display: flex; flex-direction: column;
      border-right: 0.5px solid var(--wf-hairline);
      min-height: 0;
    }
    .conversation {
      flex: 1; min-height: 0;
      display: flex; flex-direction: column;
    }
    /* Keep the conversation readable on very wide screens. */
    .conversation wf-scout-thread {
      width: 100%; max-width: 720px; margin: 0 auto;
      display: flex; flex-direction: column; min-height: 0; flex: 1;
    }
 
    .mobile-only { display: none; }
 
    @media (max-width: 860px) {
      .mobile-only { display: inline-flex; }
      .sidebar { flex-basis: 260px; }
    }
    @media (max-width: 640px) {
      .page-head { padding: 12px 14px; gap: 10px; }
      .brand .tagline { display: none; }
      .sidebar { flex: 1; border-right: none; }
      .sidebar.mobile-hidden, .conversation.mobile-hidden { display: none; }
    }
  `],
})
export class ScoutFullscreenComponent implements OnInit {
  protected state = inject(ScoutStateService);
  private history = inject(ScoutHistoryStore);
  private location = inject(Location);
 
  protected mobileShowHistory = signal(false);
 
  ngOnInit(): void {
    if (this.history.count() === 0) void this.history.load();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.goBack();
  }
 
  protected startNew(): void {
    this.state.newConversation();
    this.mobileShowHistory.set(false);
  }
 
  protected toggleMobileHistory(): void {
    this.mobileShowHistory.update((v) => !v);
  }
 
  protected onReopened(): void {
    this.mobileShowHistory.set(false);
  }
 
  goBack(): void {
    this.state.exitFullscreen();
    this.location.back();
  }
}
