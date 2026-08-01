import { Injectable, inject, effect, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
 
import { PlacesStore } from '../stores/places.store';
import { CollectionsStore } from '../stores/collections.store';
import { TripsStore } from '../stores/trips.store';
import { CategoriesStore } from '../stores/categories.store';
import { VibeTagsStore } from '../stores/vibe-tags.store';
import { AppStateStore } from '../stores/app-state.store';
import { AuthStore } from '../stores/auth.store';
import { STORAGE_ADAPTER } from '../storage/storage.token';
 
import type { Place, Collection, Trip, Category, VibeTag, AppState } from '../models';
 
// ---- Wire types (mirrors backend SyncDtos) ----
 
interface SyncData {
  places:      Place[];
  collections: Collection[];
  trips:       Trip[];
  categories:  Category[];
  vibeTags:    VibeTag[];
  appState:    AppState | null;
}
 
interface SyncPushRequest {
  since: string | null;
  data:  SyncData;
}
 
interface SyncPushResponse {
  syncedAt:        string;
  conflicts:       string[];   // ids the server kept its own copy of
  appStateConflict: boolean;
}
 
interface SyncPullResponse {
  syncedAt: string;
  data:     SyncData;
}
 
export type SyncStatus = 'idle' | 'syncing' | 'error';

/**
 * Owns the push → pull sync cycle against the backend.
 *
 * Flow:
 *   1. Collect every entity from local IndexedDB (not just in-memory store,
 *      so tombstones travel too).
 *   2. Push everything changed since `lastSyncedAt` (null on first sync →
 *      send everything).
 *   3. Pull everything the server has changed since the same `since`.
 *   4. Apply pull results to each store via `applyRemote()`.
 *   5. Stamp `lastSyncedAt` on AppStateStore.
 *
 * Conflicts: the server returns ids where it kept its own copy (its record
 * was newer). Those records already come back in the pull, so `applyRemote`
 * handles them — the conflict list is logged but no special action needed.
 *
 * Guest users: SyncService is injected everywhere but `syncNow()` is a
 * no-op if the user is not logged in (checked both in the auto-sync effect
 * and inside `syncNow()` itself). Auth is checked via AuthStore.isLoggedIn(),
 * which reflects the httpOnly session cookie — if a push 401s, we catch and
 * surface the error rather than crash.
 *
 * Auto-sync: a constructor-level effect() watches AuthStore.isLoggedIn().
 * On the transition to logged-in (covers both app-startup-while-already-
 * authenticated and a fresh login), it fires an immediate sync + profile
 * refresh and starts a 5-minute interval doing both. On logout, the
 * interval is cleared. This means the moment WorkspaceShellComponent
 * (which injects SyncService) mounts for a logged-in user, syncing (and
 * plan/profile freshness) begins automatically — no manual trigger needed.
 * The topbar "Sync now" button remains for on-demand syncs in between.
 *
 * Concurrent syncs: the `_status` signal gates re-entry — if a sync is
 * already in flight, `syncNow()` returns immediately.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private http        = inject(HttpClient);
  private storage     = inject(STORAGE_ADAPTER);
  private places      = inject(PlacesStore);
  private collections = inject(CollectionsStore);
  private trips       = inject(TripsStore);
  private categories  = inject(CategoriesStore);
  private vibeTags    = inject(VibeTagsStore);
  private appState    = inject(AppStateStore);
  private auth        = inject(AuthStore);

  private readonly base = environment.apiBaseUrl;

  private hasInitializedSync = false;
  /** How often to auto-sync while tha pp is open and the user is logged in */
  private static readonly AUTO_SYNC_INTERVAL_MS = 5 * 60_000; // 5 minutes

  private autoSyncHandle: ReturnType<typeof setInterval> | null = null;
 
  /** Reactive sync state — drives the topbar status label. */
  private _status = signal<SyncStatus>('idle');
  private _lastError = signal<string | null>(null);

  /**
   * Hard concurrency lock. True from the moment a sync starts until it
   * finishes (success or failure). Separate from the `_status` signal so the 
   * guard doesn't depend on signal read timing, and released in a finally so
   * an unexpeted throw can't wedge it. See syncNow().
   */
  private _syncing = false;

  readonly status     = this._status.asReadonly();
  readonly lastError  = this._lastError.asReadonly();

  constructor() {
    /**
     * Auto-sync scheduling, keyed off login state.
     *
     * - Logged in  → fire an immediate sync (covers app startup + login),
     *                then start a 5-minute interval.
     * - Logged out → clear the interval. Guests never auto-sync; syncNow()
     *                is also a manual no-op for them as a second guard.
     *
     * Runs once per app session since SyncService is providedIn: 'root' and
     * the effect is created here in the constructor (valid injection
     * context). No manual cleanup needed — the interval is cleared whenever
     * login state flips false, and the service itself lives for the app's
     * lifetime.
     */
    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      
      //Wrap everything else in untracked() so inner signal reads/writes 
      // do not accidentally re-trigger this effect
      untracked(() => {
        if (loggedIn && !this.hasInitializedSync) {
        // Kick off an immediate sync + profile refresh (don't await inside
        // effect — fire and forget). Profile refresh catches plan/account
        // changes that happened outside this tab (another tab, backend-side),
        // which syncNow() alone wouldn't surface since it only syncs
        // places/collections/trips/categories/vibeTags/appState, not the
        // user's plan.
        this.hasInitializedSync = true;
        void this.syncNow();
        void this.auth.refreshProfile();
 
        if (this.autoSyncHandle === null) {
          this.autoSyncHandle = setInterval(() => {
            void this.syncNow();
            void this.auth.refreshProfile();
          }, SyncService.AUTO_SYNC_INTERVAL_MS);
        }
        } else if (!loggedIn){
          // Explicitly handles logout and guest state
          if(this.autoSyncHandle !== null) {
            clearInterval(this.autoSyncHandle);
            this.autoSyncHandle = null;
          }
        }
      });
    });
  }

    /**
   * Trigger a full sync cycle. Safe to call from anywhere.
   *
   * Concurrency lock: only one sync runs at a time. A second call while one is
   * in flight is a no-op and returns false. The lock is a dedicated boolean
   * (not just the status signal) released in a finally block, so even an
   * unexpected throw can't leave it stuck "on". JS is single-threaded, so the
   * check-and-set below is atomic — there's no await between them.
   *
   * No-op for guests (defense in depth — the auto-sync effect and the topbar
   * button both already gate on login state before calling this).
   *
   * @returns true if a sync actually started, false if skipped (guest, or a
   *          sync already running).
   */
  async syncNow(): Promise<boolean> {
    if (!this.auth.isLoggedIn()) return false;
    if (this._syncing) return false;    // hard lock: one sync at a time
 
    this._syncing = true;
    this._status.set('syncing');
    this._lastError.set(null);
 
    try {
      const since = this.appState.lastSyncedAt() ?? null;
 
      // 1. Collect local data (read directly from storage so tombstones
      //    and records not yet in the store's filtered entities are included)
      const [places, collections, trips, categories, vibeTags] = await Promise.all([
        this.storage.getPlaces(),
        this.storage.getCollections(),
        this.storage.getTrips(),
        this.storage.getCategories(),
        this.storage.getVibeTags(),
      ]);
      const appStateLocal = await this.storage.getAppState();
 
      // 2. Filter to changed-since (or send all on first sync)
      const filter = <T extends { updatedAt: string }>(items: T[]) =>
        since ? items.filter((i) => i.updatedAt > since) : items;
 
      const pushPayload: SyncPushRequest = {
        since,
        data: {
          places:      filter(places),
          collections: filter(collections),
          trips:       filter(trips),
          categories:  filter(categories),
          vibeTags:    filter(vibeTags),
          // App state: send if it changed since last sync (or always on first)
          appState: appStateLocal
            ? (since && appStateLocal.lastChangeAt && appStateLocal.lastChangeAt <= since
                ? null   // no change since last sync
                : appStateLocal)
            : null,
        },
      };

      // 3. Push
      const pushRes = await firstValueFrom(
        this.http.post<SyncPushResponse>(`${this.base}/sync/push`, pushPayload)
      );
 
      if (pushRes.conflicts.length) {
        console.debug('[sync] conflicts (server kept its copy):', pushRes.conflicts);
      }
 
      // 4. Pull — use the same `since` so we get everything the server has
      //    that's newer than our last sync, including conflict winners.
      const pullRes = await firstValueFrom(
        this.http.get<SyncPullResponse>(`${this.base}/sync/pull`, {
          params: since ? { since } : {},
        })
      );
 
      // 5. Apply pull results to stores
      await this.applyPull(pullRes.data);
 
      // 6. Stamp success
      await this.appState.recordSync();

      this._status.set('idle');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this._lastError.set(msg);
      this._status.set('error');
      // Reset to idle after a short delay so the user can retry
      setTimeout(() => {
        if (this._status() === 'error') this._status.set('idle');
      }, 5_000);
      return false;
    } finally {
      // Always release the lock, even on an unexpected throw.
      this._syncing = false;
    }
  }
 
  private async applyPull(data: SyncData): Promise<void> {
    const tasks: Promise<void>[] = [];
 
    if (data.places?.length)      tasks.push(this.places.applyRemote(data.places));
    if (data.collections?.length) tasks.push(this.collections.applyRemote(data.collections));
    if (data.trips?.length)       tasks.push(this.trips.applyRemote(data.trips));
    if (data.categories?.length)  tasks.push(this.categories.applyRemote(data.categories));
    if (data.vibeTags?.length)    tasks.push(this.vibeTags.applyRemote(data.vibeTags));
 
    // App state is applied last — it may affect how other data is rendered
    if (data.appState) {
      tasks.push(this.appState.applyRemote(data.appState));
    }
 
    await Promise.all(tasks);
  }
}