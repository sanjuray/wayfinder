import { Injectable, inject, signal, computed } from '@angular/core';
import { ScoutService } from './scout.service';
import { ScoutHistoryStore } from '../../core/stores/scout-history.store';
import type { ScoutTurn } from './scout.types';
import type {
  ScoutConversation,
  PersistedScoutTurn,
} from '../../core/models/scout-conversation.model';
 
/**
 * Session-level Scout state: panel open/fullscreen, the active conversation
 * thread, and the bridge to persisted history.
 *
 * History model:
 *   - Each session's exchange is ONE conversation, identified by activeId.
 *   - After every completed Scout reply, the whole thread is saved (upsert) to
 *     the ScoutHistoryStore, which persists locally and rides the sync cycle.
 *   - Persisted turns carry place IDS only; on reopen we keep them as ids and
 *     the thread component re-resolves them live against the places store.
 *
 * Starting a "new chat" clears the active thread and forgets activeId, so the
 * next question begins a fresh conversation rather than appending to the last.
 */
@Injectable({ providedIn: 'root' })
export class ScoutStateService {
  private scout = inject(ScoutService);
  private history = inject(ScoutHistoryStore);
 
  readonly isOpen = signal(false);
  readonly isFullscreen = signal(false);
  readonly thread = signal<ScoutTurn[]>([]);
  readonly isThinking = signal(false);
 
  /** Id of the conversation currently being built/edited, or null for a fresh one. */
  private activeId = signal<string | null>(null);

  readonly hasConversation = computed(() => this.thread().length > 0);
 
  open(): void { this.isOpen.set(true); }
  close(): void { this.isOpen.set(false); }
  toggle(): void { this.isOpen.update((v) => !v); }
 
  enterFullscreen(): void { this.isFullscreen.set(true); }
  exitFullscreen(): void { this.isFullscreen.set(false); }
  toggleFullscreen(): void { this.isFullscreen.update((v) => !v); }
 
  /** Begin a brand-new conversation (does not delete the saved one). */
  newConversation(): void {
    this.thread.set([]);
    this.activeId.set(null);
  }
 
  /**
   * Load a saved conversation into the active thread. Persisted turns store
   * place ids; we rehydrate them into live ScoutTurns carrying placeIds, and
   * the thread component resolves those to Place objects on render.
   */
reopen(conversation: ScoutConversation): void {
    const turns: ScoutTurn[] = conversation.turns.map((t) => ({
      id: t.id,
      role: t.role,
      text: t.text,
      placeIds: t.placeIds,
      responseType: t.responseType,
      reasoning: t.reasoning,
    }));
    this.thread.set(turns);
    this.activeId.set(conversation.id);
  }
 
  /**
   * Send a query. Appends the user turn + a pending scout turn, resolves it in
   * place on response, then persists the whole thread.
   */
  async ask(message: string, coords?: { lat: number; lng: number }): Promise<void> {
    const trimmed = message.trim();
    if (!trimmed || this.isThinking()) return;
 
    const userTurn: ScoutTurn = { id: crypto.randomUUID(), role: 'user', text: trimmed };
    const pendingId = crypto.randomUUID();
    const pendingTurn: ScoutTurn = { id: pendingId, role: 'scout', text: '', pending: true };
 
    this.thread.update((t) => [...t, userTurn, pendingTurn]);
    this.isThinking.set(true);
 
    try {
      const res = await this.scout.query({
        message: trimmed,
        userLat: coords?.lat,
        userLng: coords?.lng,
      });

      this.replaceTurn(pendingId, {
        id: pendingId,
        role: 'scout',
        text: res.message,
        places: res.places,
        placeIds: res.places.map((p) => p.id),
        responseType: res.responseType,
        reasoning: res.reasoning,
      });
 
      await this.persist(trimmed);
    } catch {
      this.replaceTurn(pendingId, {
        id: pendingId,
        role: 'scout',
        text: 'Scout is unavailable right now. Check the assistant connection and try again.',
        error: true,
      });
      // Errored turns are not persisted — history keeps only real answers.
    } finally {
      this.isThinking.set(false);
    }
  }

  private replaceTurn(id: string, next: ScoutTurn): void {
    this.thread.update((t) => t.map((turn) => (turn.id === id ? next : turn)));
  }
 
  /**
   * Save the current thread as a conversation. Creates a new id on the first
   * save of a session, reuses it afterwards. Title comes from the first user
   * message. Transient fields (pending/error/resolved places) are stripped —
   * only durable turns with place ids are stored.
   */
  private async persist(firstUserMessageFallback: string): Promise<void> {
    const durableTurns: PersistedScoutTurn[] = this.thread()
      .filter((t) => !t.pending && !t.error)
      .map((t) => ({
        id: t.id,
        role: t.role,
        text: t.text,
        placeIds: t.placeIds,
        responseType: t.responseType,
        reasoning: t.reasoning,
      }));

    if (durableTurns.length === 0) return;
 
    let id = this.activeId();
    const now = new Date().toISOString();
    const existing = id ? this.history.getById(id) : undefined;
 
    if (!id) {
      id = crypto.randomUUID();
      this.activeId.set(id);
    }
 
    const firstUser = this.thread().find((t) => t.role === 'user');
    const title = this.makeTitle(firstUser?.text ?? firstUserMessageFallback);
 
    const conversation: ScoutConversation = {
      id,
      title,
      turns: durableTurns,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
 
    await this.history.save(conversation);
  }

  private makeTitle(firstMessage: string): string {
    const clean = firstMessage.trim().replace(/\s+/g, ' ');
    return clean.length <= 48 ? clean : clean.slice(0, 47) + '…';
  }
}
