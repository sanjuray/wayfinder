import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { STORAGE_ADAPTER } from './core/storage/storage.token';
import { LocalStorageAdapter } from './core/storage/local-storage.adapter';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { AuthStore } from './core/stores/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([credentialsInterceptor])),
    // The single point where v1 binds storage. v2 swaps this to SupabaseAdapter. Next step swaps this to
    // HttpAdapter (places -> real backend, everything else still -> IDB).
    {provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter},

    // Resolve "are we logged in?" once at startup, before the app renders —
    // avoids a flash of a login screen while the /auth/me call is in flight.
    provideAppInitializer(() => {
      const auth = inject(AuthStore);
      return auth.checkSession();
    }),


  ]
};
