import { InjectionToken } from '@angular/core';
import type { StorageAdapter } from './storage.adapter';

/**
 * The single point where the app says "here's where data lives."
 * Bound in app.config.ts to LocalStorageAdapter for v1.
 * In v2, swap to SupabaseAdapter — zero feature code changes.
 */
export const STORAGE_ADAPTER = new InjectionToken<StorageAdapter>('STORAGE_ADAPTER');