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
  syncMode: 'off',
};