import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { STORAGE_ADAPTER } from './core/storage/storage.token';
import { LocalStorageAdapter } from './core/storage/local-storage.adapter';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    // The single point where v1 binds storage. v2 swaps this to SupabaseAdapter.
    {provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter},
  ]
};
