import type { ISODate } from './place.model';

export type ThemeName = 'paper' | 'neon' | 'kyoto' | 'mono' | 'midnight' | 'subway' | 'forest';

export const THEME_NAMES: ThemeName[] = [
  'forest',
  'kyoto',
  'midnight',
  'mono',
  'neon',
  'paper',
  'subway',
]; // alphabetical, per the spec

/**
 * User's location preferences, stored as part of AppState so they
 * survive across sessions and sync to the backend alongside the rest
 * of the app state.
 *
 * `locationEnabled`:
 *   - true  → use the browser Geolocation API (watchPosition) as normal.
 *   - false → do NOT request the browser API. If `defaultLocation` is
 *             set, fly there on map init. Otherwise stay on the app
 *             default (Hyderabad).
 *
 * `defaultLocation`:
 *   Optional fixed lat/lng the user supplies as a home base. Used as
 *   the initial map position when geolocation is disabled, OR as a
 *   fallback when geolocation is denied/unavailable.
 *   Stored as plain numbers (not strings) so arithmetic (e.g. bounds
 *   padding) works without parsing.
 *
 * UI surface: Settings → Advanced → Location. Not built yet — the
 * store method `setLocationPreferences` is the write path the UI will
 * call when it lands.
 */
export interface LocationPreferences {
  locationEnabled: boolean;
  defaultLocation?: {
    lat: number;
    lng: number;
    /** Human label shown in the settings UI, e.g. "Home" or "Tokyo". */
    label?: string;
  };
}

export interface AppState {
  schemaVersion: 1;
  themePreference: ThemeName;
  autoShiftToDuskAtNight: boolean;
  taunting: { enabled: boolean; dynamicQuotesEnabled: boolean };
  storageMode: 'folder' | 'browser';
  lastBackupAt: string | undefined; // stores date
  autoBackupFrequency: 'never' | 'daily' | 'weekly' | 'monthly';
  /**
   * Timestamp of the most recent user-initiated data mutation across
   * trips, places, collections, categories, vibes. Used to drive the
   * topbar "Unsaved" indicator: if `lastChangeAt > lastBackupAt`, the
   * user has changes that haven't been backed up.
   *
   * Updated by AppStateStore.recordChange(); stores call it after their
   * write methods. Persisted so a refresh between change-and-backup
   * preserves the "unsaved" state (the data on disk hasn't been backed
   * up regardless of whether the app is open).
   *
   * `undefined` means "no changes recorded yet this session lifetime."
   * Initial app load + read-only operations don't bump this — only
   * user-initiated writes do.
   *
   * Field is required (always present on AppState) but the value is
   * optional — mirrors lastBackupAt. signalStore exposes a non-optional
   * signal that way.
   */
  lastChangeAt: ISODate | undefined;
  /**
   * Timestamp of the most recent successful backend sync (push + pull).
   * Written by SyncService after a successful cycle. undefined = never synced.
   * Drives the sync status label in the topbar popover.
   */
  lastSyncedAt: ISODate | undefined;
    /**
   * User's location preferences. Controls whether the browser Geolocation
   * API is used and provides an optional fixed default location.
   * Defaults to locationEnabled: true (opt-out model — same as browsers).
   * @see LocationPreferences
   */
  locationPreferences: LocationPreferences;
  // v2 stubs (always null in v1)
  syncMode?: 'off' | 'cloud';
  authUserId?: string;
  lastSyncAt?: ISODate;
}

export const DEFAULT_APP_STATE: AppState = {
  schemaVersion: 1,
  themePreference: 'paper',
  autoShiftToDuskAtNight: true,
  taunting: { enabled: true, dynamicQuotesEnabled: true },
  storageMode: 'browser',
  lastBackupAt: undefined,
  autoBackupFrequency: 'weekly',
  lastChangeAt: undefined,
  lastSyncedAt: undefined,
  locationPreferences: {
    locationEnabled: true,
    defaultLocation: {
      lat: 17.385,
      lng: 78.4867,
      label: 'Hyderabad',
    },
  },
  syncMode: 'off',
};