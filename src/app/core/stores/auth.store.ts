import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { UserProfile } from '../models/user.model';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  /**
   * Have we finished the initial /auth/me check yet? The app shell should
   * wait for this before deciding whether to show a login screen or the
   * map — otherwise you'd flash a login page for a second on every refresh
   * while the /me call is still in flight.
   */
  initialized: boolean;
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  initialized: false,
};

/**
 * Auth state. Deliberately holds NO token — with an httpOnly cookie, the
 * browser owns the token entirely and this app can't read it even if it
 * wanted to. "Are we logged in" is answered by whether `user` is populated,
 * which is learned by asking the backend (GET /auth/me), not by inspecting
 * anything stored client-side.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    isLoggedIn: computed(() => store.user() !== null),
    isCircle: computed(() => store.user()?.plan === 'circle'),
  })),
  withMethods((store) => {
    const http = inject(HttpClient);
    const base = environment.apiBaseUrl;

    /**
     * Call once at app startup. Because the JWT lives in an httpOnly cookie,
     * the browser attaches it automatically (see credentials.interceptor) —
     * if this succeeds, the user has a valid session; if it 401s, they don't.
     * Either way this never throws upward — it just leaves `user` null on
     * failure, which is a normal "not logged in" state, not an app error.
     */
    async function checkSession(): Promise<void> {
      try {
        const user = await firstValueFrom(http.get<UserProfile>(`${base}/auth/me`));
        patchState(store, { user, initialized: true });
      } catch {
        patchState(store, { user: null, initialized: true });
      }
    }

     /**
       * Silently re-fetch the current user profile (GET /auth/me) and patch
       * `user` in place — same endpoint as checkSession(), but deliberately
       * does NOT touch `initialized` or `loading`. This is meant to be called
       * repeatedly during a session (on Settings mount, on the sync interval)
       * to catch plan/profile changes that happened outside this tab's own
       * mutations (upgrade()/cancelCircle() already patch state directly on
       * success, so this covers everything else — backend-side changes,
       * another tab, a stale long-lived session).
       *
       * No-op if not logged in — avoids firing an authenticated request (and
       * the resulting 401 noise) for guests. Failures are swallowed: a
       * transient network blip here shouldn't disrupt the UI or flip the
       * user to "logged out" the way checkSession()'s catch-all does.
     */
    async function refreshProfile(): Promise<void> {
      if (!store.user()) return;
      try {
        const user = await firstValueFrom(http.get<UserProfile>(`${base}/auth/me`));
        patchState(store, { user });
      } catch {
        // Swallow — a failed background refresh shouldn't log the user out
        // or surface an error; the next attempt will retry.
      }
    }

    async function signup(email: string, password: string, displayName?: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const res = await firstValueFrom(
          http.post<{ user: UserProfile }>(`${base}/auth/signup`, { email, password, displayName })
        );
        patchState(store, { user: res.user, loading: false });
      } catch (err) {
        patchState(store, { error: 'Signup failed', loading: false });
        throw err;
      }
    }

    async function login(email: string, password: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const res = await firstValueFrom(
          http.post<{ user: UserProfile }>(`${base}/auth/login`, { email, password })
        );
        patchState(store, { user: res.user, loading: false });
      } catch (err) {
        patchState(store, { error: 'Invalid email or password', loading: false });
        throw err;
      }
    }

    async function logout(): Promise<void> {
      try {
        await firstValueFrom(http.post(`${base}/auth/logout`, {}));
      } finally {
        // Clear local state regardless of whether the server call succeeded —
        // an already-expired session shouldn't trap the user logged in visually.
        patchState(store, { user: null });
      }
    }

    // async function upgrade(): Promise<void> {
    //   const res = await firstValueFrom(
    //     http.post<{ user: UserProfile }>(`${base}/auth/upgrade`, {})
    //   );
    //   patchState(store, { user: res.user });
    // }

    async function upgrade(): Promise<void> {
      // POST /upgrade returns AuthResponse ({ user }), same wrapper as login.
      const updated = await firstValueFrom(
        http.post<{ user: UserProfile }>(`${base}/auth/upgrade`, {}, {})
      );
      patchState(store, { user: updated.user });
    }

    async function updateProfile(patch: { displayName?: string; handle?: string }): Promise<void> {
      // PATCH /me returns a bare UserDto (NOT wrapped) - same as GET /me
      const updated = await firstValueFrom(
        http.patch<UserProfile>(`${base}/auth/me`, patch)
      );
      patchState(store, { user: updated });
    }
 
    async function checkHandleAvailable(handle: string): Promise<boolean> {
      const res = await firstValueFrom(
        http.get<{ handle: string; available: boolean }>(
          `${environment.apiBaseUrl}/auth/handle-available`,
          { params: { handle } }
        )
      );
      return res.available;
    }    

    async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
      try {
        await firstValueFrom(
          http.post(`${base}/auth/change-password`,
            { currentPassword, newPassword })
        );
      } catch (e: any) {
        const code = e?.error?.code;                       // backend ApiError.code
        throw Object.assign(new Error('change-password failed'), { code });
      }
    }
    
    async function cancelCircle(): Promise<void> {
      // POST /cancel returns AuthResponse ({ user }), same wrapper as login.
      const updated = await firstValueFrom(
        http.post<{user: UserProfile}>(`${base}/auth/cancel`, {})
      );
      patchState(store, { user: updated.user });
    }

    return { checkSession, refreshProfile, signup, login, logout, upgrade, updateProfile, checkHandleAvailable, changePassword, cancelCircle };
  })
);