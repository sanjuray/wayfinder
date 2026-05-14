import { signalStore, withState, withMethods, patchState, getState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { DEFAULT_APP_STATE, type AppState, type ThemeName } from '../models';

export const AppStateStore = signalStore(
  { providedIn: 'root' },
  withState<AppState>(DEFAULT_APP_STATE),
  withMethods((store) => {
    const storage = inject(STORAGE_ADAPTER);

    async function load() {
      const state = await storage.getAppState();
      if (state) {
        patchState(store, state);
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

    return { load, setTheme, patch };
  })
);