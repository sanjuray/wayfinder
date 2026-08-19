import { Component, inject, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { ScoutStateService } from './scout-state.service';
import { ScoutThreadComponent } from './scout-thread.component';
import { ScoutHistoryPanelComponent } from './scout-history-panel.component';
 
/**
 * The Scout entry point on the map. A floating pill button sits top-right in
 * the map area (below the topbar). Clicking it opens a compact panel anchored
 * under the button. The panel can be expanded to fullscreen (routes to /scout),
 * started fresh (new chat), or switched to the history list.
 *
 * Keyboard: Escape closes the panel (matches place-detail / picker-column).
 */
@Component({
  selector: 'wf-scout-bubble',
  standalone: true,
  imports: [ScoutThreadComponent, ScoutHistoryPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="bubble"
      [class.on]="state.isOpen()"
      (click)="state.toggle()"
      aria-label="Ask Scout"
      [attr.aria-expanded]="state.isOpen()">
      <span class="mark" aria-hidden="true">◇</span>
      <span class="label">Scout</span>
    </button>
 
    @if (state.isOpen()) {
      <div class="panel" role="dialog" aria-label="Scout assistant">
        <header class="panel-head">
          @if (showHistory) {
            <button class="ghost back" (click)="showHistory = false" aria-label="Back to conversation" title="Back">←</button>
          }
          <div class="title">
            <span class="mark" aria-hidden="true">◇</span>
            <span>{{ showHistory ? 'History' : 'Scout' }}</span>
          </div>
          <div class="actions">
            @if (!showHistory) {
              <button class="ghost" (click)="startNew()" aria-label="New conversation" title="New chat">＋</button>
              <button class="ghost" (click)="showHistory = true" aria-label="History" title="History">🕐</button>
              <button class="ghost" (click)="expand()" aria-label="Open fullscreen" title="Fullscreen">⤢</button>
            }
            <button class="ghost" (click)="state.close()" aria-label="Close" title="Close">×</button>
          </div>
        </header>
 
        @if (showHistory) {
          <wf-scout-history-panel (opened)="showHistory = false" />
        } @else {
          <wf-scout-thread [closeOnSelect]="true" />
        }
      </div>
    }
  `,
  styles: [`
    :host {
      position: absolute;
      top: 18px;
      right: 18px;
      z-index: 4;
      display: block;
    }
    .bubble {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px;
      min-height: var(--wf-touch, 44px);
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: var(--wf-radius-pill, 999px);
      box-shadow: 0 2px 12px rgba(0,0,0,0.06);
      cursor: pointer;
      transition: box-shadow .2s, border-color .15s, transform .12s;
      margin-left: auto;
    }
    .bubble:hover { box-shadow: var(--wf-glow); transform: translateY(-1px); }
    .bubble.on { border-color: var(--wf-accent); box-shadow: var(--wf-glow); }
    .bubble:focus-visible { outline: none; box-shadow: var(--wf-ring); }
    .bubble .mark { color: var(--wf-accent); font-size: 15px; }
    .bubble .label {
      font-family: var(--wf-font-body);
      font-size: 14px; font-weight: 600; color: var(--wf-ink);
    }
 
    .panel {
      position: absolute;
      top: 52px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 36px);
      height: 560px;
      max-height: calc(100vh - 140px);
      display: flex;
      flex-direction: column;
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: 18px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.16);
      overflow: hidden;
      animation: scout-panel-in .18s ease-out;
    }
    .panel-head {
      flex: 0 0 auto;
      display: flex; align-items: center; justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 0.5px solid var(--wf-hairline);
    }
    .title {
      display: flex; align-items: center; gap: 8px;
      font-family: var(--wf-font-display);
      font-size: 15px; font-weight: 600; color: var(--wf-ink);
      flex: 1;
    }
    .title .mark { color: var(--wf-accent); }
    .actions { display: flex; gap: 2px; }
    .ghost {
      width: var(--wf-touch, 44px); height: var(--wf-touch, 44px);
      display: grid; place-items: center;
      background: transparent; border: none;
      color: var(--wf-ink-soft); font-size: 16px;
      border-radius: 10px; cursor: pointer;
      transition: background .12s, color .12s;
    }
    .ghost:hover { background: var(--wf-bg-2); color: var(--wf-ink); }
    .ghost:focus-visible { outline: none; box-shadow: var(--wf-ring); }
    .ghost.back { margin-right: -4px; }
 
    @keyframes scout-panel-in {
      from { opacity: 0; transform: translateY(-8px) scale(.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel { animation: none; }
      .bubble:hover { transform: none; }
    }
    @media (hover: none) and (pointer: coarse) {
      .bubble:hover { transform: none; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    }
 
    /* Narrow screens: compact panel becomes a near-fullscreen sheet. */
    @media (max-width: 640px) {
      :host { top: 12px; right: 12px; }
      .bubble .label { display: none; }   /* icon-only pill on phones */
      .bubble { padding: 10px; width: var(--wf-touch, 44px); justify-content: center; }
      .panel {
        position: fixed;
        top: 64px; right: 8px; left: 8px;
        width: auto;
        height: calc(100dvh - 80px);
        max-height: none;
      }
    }
  `],
})
export class ScoutBubbleComponent {
  protected state = inject(ScoutStateService);
  private router = inject(Router);
 
  protected showHistory = false;
 
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.state.isOpen()) {
      if (this.showHistory) this.showHistory = false;
      else this.state.close();
    }
  }
 
  protected startNew(): void {
    this.state.newConversation();
    this.showHistory = false;
  }
 
  protected expand(): void {
    this.state.enterFullscreen();
    this.state.close();
    this.router.navigate(['/scout']);
  }
}
