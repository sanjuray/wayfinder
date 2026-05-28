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
  syncMode: 'off',
};