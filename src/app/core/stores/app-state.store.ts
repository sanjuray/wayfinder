import { signalStore, withState, withMethods, patchState, getState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { DEFAULT_APP_STATE, LocationPreferences, type AppState, type ThemeName } from '../models';

export const AppStateStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>(DEFAULT_APP_STATE),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);

    async function load() {
      const state = await storage.getAppState();
      if (state) {
        // Merge loaded state with defaults to handle new fields added
        // after a user's state was last persisted (e.g. locationPreferences
        // for users upgrading from a build that predates this field).
        patchState(store, { ...DEFAULT_APP_STATE, ...state });
      } else {
        await storage.setAppState(DEFAULT_APP_STATE);
      }
    }

    async function setTheme(theme: ThemeName) {
      patchState(store, { themePreference: theme });
      await storage.setAppState(getState(store));
    }

    async function patch(partial: Partial<AppState>) {
      patchState(store, partial);
      await storage.setAppState(getState(store));
    }

    /*
     * Update location preferences and persist immediately.
     * The settings UI calls this when the user toggles geolocation or
     * saves a default location. Merges with the existing prefs so callers
     * can update a single field without resetting the rest.
     *
     * Usage (from the future Settings → Advanced → Location section):
     *   appState.setLocationPreferences({ locationEnabled: false });
     *   appState.setLocationPreferences({ defaultLocation: { lat: 35.68, lng: 139.69, label: 'Tokyo' } });
     */
    async function setLocationPreferences(prefs: Partial<LocationPreferences>): Promise<void> {
      const merged: LocationPreferences = {
        ...store.locationPreferences(),
        ...prefs,
        // Preserve nested defaultLocation if only locationEnabled changed
        defaultLocation: prefs.defaultLocation !== undefined
          ? prefs.defaultLocation
          : store.locationPreferences().defaultLocation,
      };
      patchState(store, { locationPreferences: merged });
      await storage.setAppState(getState(store));
    }

    /**
     * Mark "data has changed since the last backup." Called from every
     * store after a user-initiated mutation (create/update/delete) — NOT
     * from load() or other read-only operations.
     *
     * Fire-and-forget: callers don't await this. We update in-memory
     * state synchronously (so the indicator flips immediately) and
     * persist to storage in the background. If the storage write fails,
     * the in-memory flip still stands and the user sees "unsaved" — a
     * conservative-correct outcome.
     */
    function recordChange(): void {
      const now = new Date().toISOString();
      patchState(store, { lastChangeAt: now });
      // Fire-and-forget persistence; the in-memory flip already happened
      void storage.setAppState(getState(store));
    }

    /**
     * Mark "the user just backed up." Resets the unsaved indicator by
     * setting lastBackupAt to now. Should be called from the backup/
     * export flow after the export file is written.
     *
     * Sets lastBackupAt > lastChangeAt by writing now to lastBackupAt
     * AND clearing lastChangeAt — clearing is belt-and-braces in case
     * a stray recordChange() races during export.
     */
    async function recordBackup(): Promise<void> {
      const now = new Date().toISOString();
      patchState(store, { lastBackupAt: now, lastChangeAt: undefined });
      await storage.setAppState(getState(store));
    }

    return { load, setTheme, patch, setLocationPreferences, recordChange, recordBackup };
  })
);