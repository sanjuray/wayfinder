import { Injectable, inject, signal, computed } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { AppStateStore } from './app-state.store';
import type { ScoutConversation } from '../models/scout-conversation.model';
 
/**
 * Holds saved Scout conversations. Mirrors the discipline of the other entity
 * stores: it is the ONLY thing that talks to the storage adapter for
 * conversations, exposes signals for the UI, and records a change on every
 * mutation so the saved-indicator + sync pick it up.
 *
 * Sorting: most-recently-updated first (that's the useful order for a history
 * list). Tombstones are filtered out of `entities()` but remain in storage so
 * deletes propagate through sync.
 */
@Injectable({ providedIn: 'root' })
export class ScoutHistoryStore {
  private storage = inject(STORAGE_ADAPTER);
  private appState = inject(AppStateStore);
 
  private readonly _all = signal<ScoutConversation[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
 
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
 
  /** Live conversations (no tombstones), newest-updated first. */
  readonly entities = computed(() =>
    this._all()
      .filter((c) => !c.deletedAt)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  );

  readonly count = computed(() => this.entities().length);
 
  async load(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const all = await this.storage.getScoutConversations();
      this._all.set(all);
    } catch (e) {
      this._error.set('Could not load Scout history.');
    } finally {
      this._loading.set(false);
    }
  }
 
  getById(id: string): ScoutConversation | undefined {
    return this._all().find((c) => c.id === id);
  }
 
  /** Create or update a conversation, persist it, and record the change. */
  async save(conversation: ScoutConversation): Promise<void> {
    try {
      await this.storage.upsertScoutConversation(conversation);
      this._all.update((list) => {
        const idx = list.findIndex((c) => c.id === conversation.id);
        if (idx === -1) return [...list, conversation];
        const next = [...list];
        next[idx] = conversation;
        return next;
      });
      this.appState.recordChange();
    } catch (e) {
      this._error.set('Could not save this conversation.');
    }
  }
 
  /** Soft-delete: stamp deletedAt, keep the row (so the delete syncs). */
  async remove(id: string): Promise<void> {
    const existing = this.getById(id);
    if (!existing) return;
    const now = new Date().toISOString();
    const tomb: ScoutConversation = { ...existing, deletedAt: now, updatedAt: now };
    try {
      await this.storage.upsertScoutConversation(tomb);
      this._all.update((list) => list.map((c) => (c.id === id ? tomb : c)));
      this.appState.recordChange();
    } catch (e) {
      this._error.set('Could not delete this conversation.');
    }
  }
 
  /** Apply records pulled from the server during sync (tombstones included). */
  async applyRemote(incoming: ScoutConversation[]): Promise<void> {
    for (const c of incoming) {
      await this.storage.upsertScoutConversation(c);
    }
    this._all.update((list) => {
      const byId = new Map(list.map((c) => [c.id, c]));
      for (const c of incoming) byId.set(c.id, c);
      return [...byId.values()];
    });
  }
}
