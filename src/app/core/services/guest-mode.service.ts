import { Injectable, signal } from '@angular/core';

const KEY = 'wf_guest_mode';

@Injectable({ providedIn: 'root' })
export class GuestModeService {
  private readonly _isGuest = signal<boolean>(this.read());
  readonly isGuest = this._isGuest.asReadonly();

  enterAsGuest(): void {
    this._isGuest.set(true);
    try { sessionStorage.setItem(KEY, '1'); } catch { /* storage may be unavailable */ }
  }

  clear(): void {
    this._isGuest.set(false);
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  }

  private read(): boolean {
    try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
  }
}