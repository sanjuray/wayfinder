import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { IdService } from '../services/id.service';
import { AppStateStore } from './app-state.store';
import { DEFAULT_VIBE_TAGS } from '../seed/default-vibe-tags';
import type { VibeTag } from '../models';

interface VibeTagsState {
  entities: VibeTag[];
  loading: boolean;
  error: string | null;
}

const initialState: VibeTagsState = { entities: [], loading: false, error: null };

export const VibeTagsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    sorted: computed(() =>
      [...store.entities()].sort((a, b) => a.name.localeCompare(b.name))
    ),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);
    const idService = inject(IdService);
    const appState = inject(AppStateStore);

    function nameAvailable(candidate: string, ignoreId?: string): boolean {
      const target = candidate.trim().toLowerCase();
      if (!target) return false;
      return !store.entities().some(
        (t) => t.id !== ignoreId && t.name.trim().toLowerCase() === target
      );
    }

    async function load() {
      patchState(store, { loading: true, error: null });
      try {
        let entities = await storage.getVibeTags();
 
        if (entities.length === 0) {
          // Ids come from the seed (fixed) — do NOT generate here, see
          // default-vibe-tags.ts for why (sync-dedupe).
          const now = new Date().toISOString();
          entities = DEFAULT_VIBE_TAGS.map((t) => ({
            ...t,
            createdAt: now,
            updatedAt: now,
          }));
          for (const t of entities) {
            await storage.upsertVibeTag(t);
          }
        } else {
          // Backfill: vibe tags created before timestamps existed get
          // stamped once and persisted, so sync's changed-since filter works.
          const now = new Date().toISOString();
          for (let i = 0; i < entities.length; i++) {
            const t = entities[i];
            if (!t.createdAt || !t.updatedAt) {
              const upgraded: VibeTag = {
                ...t,
                createdAt: t.createdAt ?? now,
                updatedAt: t.updatedAt ?? now,
              };
              await storage.upsertVibeTag(upgraded);
              entities[i] = upgraded;
            }
          }
        }
 
        // Filter out soft-deleted vibe tags at load time
        entities = entities.filter((t) => !t.deletedAt);
 
        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }

    /**
     * Add a new vibe tag. Callers may omit createdAt/updatedAt — they're
     * stamped here, so call sites (vibe-tag-manager) stay clean.
     */
    async function add(t: Omit<VibeTag, 'createdAt' | 'updatedAt'> & Partial<Pick<VibeTag, 'createdAt' | 'updatedAt'>>) {
      const now = new Date().toISOString();
      const stamped: VibeTag = {
        ...t,
        createdAt: t.createdAt ?? now,
        updatedAt: now,
      };
      await storage.upsertVibeTag(stamped);
      patchState(store, { entities: [...store.entities(), stamped] });
      appState.recordChange();
    }
 
    async function update(t: VibeTag) {
      const stamped: VibeTag = { ...t, updatedAt: new Date().toISOString() };
      await storage.upsertVibeTag(stamped);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === t.id ? stamped : x)),
      });
      appState.recordChange();
    }
 
    /**
     * Soft-delete: marks the record with deletedAt (tombstone) and keeps it
     * in IndexedDB so the deletion propagates through sync to other devices.
     * Removed from in-memory entities so the UI updates immediately.
     */
    async function remove(id: string) {
      const current = store.entities().find((t) => t.id === id);
      if (!current) return;
      const now = new Date().toISOString();
      const deleted: VibeTag = { ...current, deletedAt: now, updatedAt: now };
      await storage.upsertVibeTag(deleted);
      patchState(store, { entities: store.entities().filter((t) => t.id !== id) });
      appState.recordChange();
    }

    function getById(id: string): VibeTag | undefined {
      return store.entities().find((t) => t.id === id);
    }

    /**
     * Merge server vibe tag records into local store + IndexedDB.
     * Last-write-wins by updatedAt. Does not call recordChange().
     */
    async function applyRemote(incoming: VibeTag[]): Promise<void> {
      if (!incoming.length) return;
      const allLocal = await storage.getVibeTags();
      const allById = new Map(allLocal.map((v) => [v.id, v]));
      const nextEntities = [...store.entities()];
 
      for (const remote of incoming) {
        const local = allById.get(remote.id);
        if (local && local.updatedAt >= remote.updatedAt) continue;
 
        await storage.upsertVibeTag(remote);
 
        if (remote.deletedAt) {
          const idx = nextEntities.findIndex((v) => v.id === remote.id);
          if (idx !== -1) nextEntities.splice(idx, 1);
        } else {
          const idx = nextEntities.findIndex((v) => v.id === remote.id);
          if (idx !== -1) nextEntities[idx] = remote;
          else nextEntities.push(remote);
        }
      }
      patchState(store, { entities: nextEntities });
    }
 
    return { load, add, update, remove, getById, nameAvailable, applyRemote };
  })
);