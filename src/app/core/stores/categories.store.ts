import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { IdService } from '../services/id.service';
import { AppStateStore } from './app-state.store';
import { DEFAULT_CATEGORIES } from '../seed/default-categories';
import type { Category } from '../models';

interface CategoriesState {
  entities: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoriesState = { entities: [], loading: false, error: null };

export const CategoriesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    visible: computed(() => store.entities().filter((c) => !c.hidden)),
    sorted: computed(() =>
      [...store.entities()].sort((a, b) => a.name.localeCompare(b.name))
    ),
  })),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);
    const idService = inject(IdService);
    const appState = inject(AppStateStore);

    /**
     * Case-insensitive name uniqueness check. ignoreId excludes a
     * specific category from the comparison — pass when renaming so the
     * category's current name doesn't count as a self-collision.
     */
    function nameAvailable(candidate: string, ignoreId?: string): boolean {
      const target = candidate.trim().toLowerCase();
      if (!target) return false;
      return !store.entities().some(
        (c) => c.id !== ignoreId && c.name.trim().toLowerCase() === target
      );
    }

    /**
     * One-time heal for the pre-deterministic-id duplicate bug.
     *
     * Before default categories had fixed ids, each device seeded them with
     * random uuids. This produced duplicates once sync merged two devices'
     * defaults. This function collapses each default (identified by matching a
     * canonical name in DEFAULT_CATEGORIES) onto its fixed id:
     *   - if the fixed-id row is missing, re-key the stray onto the fixed id;
     *   - if both exist, keep the fixed-id one and drop the stray;
     *   - either way, repoint any place.categoryId that referenced the old id.
     *
     * Idempotent and cheap: once everything is on fixed ids, it finds nothing.
     * Returns the healed entity list for the caller to patch into the store.
     */
    async function dedupeDefaults(entities: Category[]): Promise<Category[]> {
      // canonical name(lower) -> fixed id
      const canonicalByName = new Map(
        DEFAULT_CATEGORIES.map((c) => [c.name.trim().toLowerCase(), c.id])
      );
      const existingIds = new Set(entities.map((c) => c.id));
 
      // old id -> fixed id remaps we need to perform
      const remap = new Map<string, string>();
      for (const c of entities) {
        if (!c.isDefault) continue;
        const fixedId = canonicalByName.get(c.name.trim().toLowerCase());
        if (fixedId && c.id !== fixedId) {
          remap.set(c.id, fixedId);
        }
      }
      if (remap.size === 0) return entities; // nothing to heal

      const now = new Date().toISOString();
      let working = [...entities];
 
      for (const [oldId, fixedId] of remap) {
        const stray = working.find((c) => c.id === oldId);
        if (!stray) continue;
 
        if (existingIds.has(fixedId)) {
          // Fixed-id twin already present → just drop the stray.
          await storage.deleteCategory(oldId);
          working = working.filter((c) => c.id !== oldId);
        } else {
          // Re-key the stray onto the fixed id.
          const rekeyed: Category = { ...stray, id: fixedId, updatedAt: now };
          await storage.deleteCategory(oldId);
          await storage.upsertCategory(rekeyed);
          working = working.map((c) => (c.id === oldId ? rekeyed : c));
          existingIds.add(fixedId);
        }

        // Repoint any places that referenced the old category id.
        const places = await storage.getPlaces();
        for (const p of places) {
          if (p.categoryId === oldId) {
            await storage.upsertPlace({ ...p, categoryId: fixedId, updatedAt: now });
          }
        }
      }
 
      return working;
    }

        async function load() {
      patchState(store, { loading: true, error: null });
      try {
        let entities = await storage.getCategories();
 
        // Seed defaults on first launch. Ids come from the seed (fixed /
        // deterministic) — do NOT generate new ones here, or two devices would
        // seed the same logical category with different ids and sync would
        // duplicate them.
        if (entities.length === 0) {
          const now = new Date().toISOString();
          entities = DEFAULT_CATEGORIES.map((c) => ({
            ...c,
            createdAt: now,
            updatedAt: now,
          }));
          for (const c of entities) {
            await storage.upsertCategory(c);
          }
        } else {
          // Backfill: categories created before timestamps existed get
          // stamped once and persisted, so sync's changed-since filter works.
          const now = new Date().toISOString();
          for (let i = 0; i < entities.length; i++) {
            const c = entities[i];
            if (!c.createdAt || !c.updatedAt) {
              const upgraded: Category = {
                ...c,
                createdAt: c.createdAt ?? now,
                updatedAt: c.updatedAt ?? now,
              };
              await storage.upsertCategory(upgraded);
              entities[i] = upgraded;
            }
          }
 
          // One-time heal for the pre-fix duplicate bug: default categories
          // seeded before deterministic ids existed have random ids. If we
          // detect a default whose id isn't the canonical fixed one, remap it
          // to the fixed id (repointing any places that reference the old id)
          // and drop the stray. Idempotent — a second run finds nothing to do.
          entities = await dedupeDefaults(entities);
        }
 
        // Filter out soft-deleted categories at load time
        entities = entities.filter((c) => !c.deletedAt);
 
        patchState(store, { entities, loading: false });
      } catch (err) {
        patchState(store, { error: String(err), loading: false });
      }
    }
 
    /**
     * Add a new category. Callers may omit createdAt/updatedAt — they're
     * stamped here. This keeps call sites (category-manager) clean and is
     * the single place timestamps get set on creation.
     */
    async function add(c: Omit<Category, 'createdAt' | 'updatedAt'> & Partial<Pick<Category, 'createdAt' | 'updatedAt'>>) {
      const now = new Date().toISOString();
      const stamped: Category = {
        ...c,
        createdAt: c.createdAt ?? now,
        updatedAt: now,
      };
      await storage.upsertCategory(stamped);
      patchState(store, { entities: [...store.entities(), stamped] });
      appState.recordChange();
    }
 
    async function update(c: Category) {
      const stamped: Category = { ...c, updatedAt: new Date().toISOString() };
      await storage.upsertCategory(stamped);
      patchState(store, {
        entities: store.entities().map((x) => (x.id === c.id ? stamped : x)),
      });
      appState.recordChange();
    }
 
    /**
     * Soft-delete: marks the record with deletedAt (tombstone) and keeps it
     * in IndexedDB so the deletion propagates through sync to other devices.
     * Removed from in-memory entities so the UI updates immediately.
     */
    async function remove(id: string) {
      const current = store.entities().find((c) => c.id === id);
      if (!current) return;
      const now = new Date().toISOString();
      const deleted: Category = { ...current, deletedAt: now, updatedAt: now };
      await storage.upsertCategory(deleted);
      patchState(store, { entities: store.entities().filter((c) => c.id !== id) });
      appState.recordChange();
    }

    function getById(id: string): Category | undefined {
      return store.entities().find((c) => c.id === id);
    }

    /**
     * Merge server category records into local store + IndexedDB.
     * Last-write-wins by updatedAt. Does not call recordChange().
     */
    async function applyRemote(incoming: Category[]): Promise<void> {
      if (!incoming.length) return;
      const allLocal = await storage.getCategories();
      const allById = new Map(allLocal.map((c) => [c.id, c]));
      const nextEntities = [...store.entities()];
 
      for (const remote of incoming) {
        const local = allById.get(remote.id);
        if (local && local.updatedAt >= remote.updatedAt) continue;
 
        await storage.upsertCategory(remote);
 
        if (remote.deletedAt) {
          const idx = nextEntities.findIndex((c) => c.id === remote.id);
          if (idx !== -1) nextEntities.splice(idx, 1);
        } else {
          const idx = nextEntities.findIndex((c) => c.id === remote.id);
          if (idx !== -1) nextEntities[idx] = remote;
          else nextEntities.push(remote);
        }
      }
      patchState(store, { entities: nextEntities });
    }
 
    return { load, add, update, remove, getById, nameAvailable, applyRemote };
  })
);