import {
  Component, inject, output, signal, ChangeDetectionStrategy, OnInit,
} from '@angular/core';
import { ScoutStateService } from './scout-state.service';
import { ScoutHistoryStore } from '../../core/stores/scout-history.store';
import type { ScoutConversation } from '../../core/models/scout-conversation.model';
 
/**
 * The saved-conversations list. Shown inside the compact panel (replacing the
 * thread) or in the fullscreen view's sidebar/section. Reopen loads a
 * conversation into the active thread; delete soft-removes it (syncs as a
 * tombstone). Loads history on init if the store is empty.
 */
@Component({
  selector: 'wf-scout-history-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="history">
      @if (history.loading()) {
        <div class="state">Loading…</div>
      } @else if (history.count() === 0) {
        <div class="state empty">
          <p>No saved conversations yet.</p>
          <p class="hint">Ask Scout something and it'll be saved here.</p>
        </div>
      } @else {
        <ul class="list">
          @for (c of history.entities(); track c.id) {
            <li class="row">
              <button class="open" (click)="reopen(c)" [attr.aria-label]="'Reopen ' + (c.title || 'conversation')">
                <span class="c-title">{{ c.title || 'Untitled' }}</span>
                <span class="c-meta">{{ turnCount(c) }} · {{ when(c) }}</span>
              </button>
              @if (confirmingId() === c.id) {
                <button class="confirm" (click)="doDelete(c.id)" aria-label="Confirm delete">Delete?</button>
              } @else {
                <button class="del" (click)="confirmingId.set(c.id)" aria-label="Delete conversation" title="Delete">🗑</button>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .history { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px; }
    .state {
      margin: auto; text-align: center; color: var(--wf-ink-soft);
      padding: 40px 16px; font-size: 14px;
    }
    .state.empty p { margin: 4px 0; }
    .state .hint { color: var(--wf-ink-faint); font-size: 13px; }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .row {
      display: flex; align-items: stretch; gap: 4px;
      border: 0.5px solid var(--wf-hairline);
      border-radius: var(--wf-radius-card, 14px);
      overflow: hidden;
      transition: border-color .15s;
    }
    .row:hover { border-color: var(--wf-accent); }
    .open {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 3px;
      text-align: left;
      padding: 11px 14px;
      min-height: var(--wf-touch, 44px);
      background: transparent; border: none; cursor: pointer;
    }
    .open:focus-visible { outline: none; box-shadow: var(--wf-ring); border-radius: var(--wf-radius-card, 14px); }
    .c-title {
      font-family: var(--wf-font-body); font-size: 14px; font-weight: 600; color: var(--wf-ink);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .c-meta { font-size: 12px; color: var(--wf-ink-soft); }
    .del, .confirm {
      flex: 0 0 auto;
      display: grid; place-items: center;
      background: transparent; border: none; cursor: pointer;
      border-left: 0.5px solid var(--wf-hairline-soft);
      transition: background .12s, color .12s;
    }
    .del { width: var(--wf-touch, 44px); color: var(--wf-ink-faint); font-size: 15px; }
    .del:hover { background: var(--wf-bg-2); color: var(--wf-accent-2); }
    .confirm {
      padding: 0 14px; color: var(--wf-accent-2); font-size: 13px; font-weight: 600;
      white-space: nowrap;
    }
    .confirm:hover { background: color-mix(in srgb, var(--wf-accent) 12%, var(--wf-bg)); }
    .del:focus-visible, .confirm:focus-visible { outline: none; box-shadow: var(--wf-ring); }
    @media (hover: none) and (pointer: coarse) {
      .row:hover { border-color: var(--wf-hairline); }
    }
  `],
})
export class ScoutHistoryPanelComponent implements OnInit {
  protected history = inject(ScoutHistoryStore);
  private state = inject(ScoutStateService);
 
  /** Emitted after reopening, so the host can switch back to the thread view. */
  readonly opened = output<void>();
 
  protected confirmingId = signal<string | null>(null);
 
  ngOnInit(): void {
    if (this.history.count() === 0) {
      void this.history.load();
    }
  }

  protected reopen(c: ScoutConversation): void {
    this.state.reopen(c);
    this.opened.emit();
  }
 
  protected async doDelete(id: string): Promise<void> {
    await this.history.remove(id);
    this.confirmingId.set(null);
  }
 
  protected turnCount(c: ScoutConversation): string {
    const asks = c.turns.filter((t) => t.role === 'user').length;
    return asks === 1 ? '1 ask' : `${asks} asks`;
  }
 
  protected when(c: ScoutConversation): string {
    const d = new Date(c.updatedAt);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}
