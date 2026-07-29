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
      const updated = await firstValueFrom(
        http.post<UserProfile>(`${environment.apiBaseUrl}/auth/upgrade`, {}, { withCredentials: true })
      );
      patchState(store, { user: updated });
    }

    async function updateProfile(patch: { displayName?: string; handle?: string }): Promise<void> {
      const updated = await firstValueFrom(
        http.patch<UserProfile>(`${environment.apiBaseUrl}/auth/me`, patch, { withCredentials: true })
      );
      patchState(store, { user: updated });
    }
 
    async function checkHandleAvailable(handle: string): Promise<boolean> {
      const res = await firstValueFrom(
        http.get<{ handle: string; available: boolean }>(
          `${environment.apiBaseUrl}/auth/handle-available`,
          { params: { handle }, withCredentials: true }
        )
      );
      return res.available;
    }    

    async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
      try {
        await firstValueFrom(
          http.post(`${environment.apiBaseUrl}/auth/change-password`,
            { currentPassword, newPassword }, { withCredentials: true })
        );
      } catch (e: any) {
        const code = e?.error?.code;                       // backend ApiError.code
        throw Object.assign(new Error('change-password failed'), { code });
      }
    }
    
    async function cancelCircle(): Promise<void> {
      const updated = await firstValueFrom(
        http.post<UserProfile>(`${environment.apiBaseUrl}/auth/cancel`, {}, { withCredentials: true })
      );
      patchState(store, { user: updated });
    }

    return { checkSession, signup, login, logout, upgrade, updateProfile, checkHandleAvailable, changePassword, cancelCircle };
  })
);