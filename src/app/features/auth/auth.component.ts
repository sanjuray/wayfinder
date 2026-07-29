import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
 
import { AuthStore } from '../../core/stores/auth.store';
import { GuestModeService } from '../../core/services/guest-mode.service';
import { TaglineService } from '../../core/services/tagline.service';
 
type Mode = 'login' | 'signup';

/**
 * Split-panel auth screen — login and signup in one component, toggled in
 * place. Used by both /login and /signup (initial mode comes from route
 * data). "Continue as guest" is the third path: it opts into guest mode and
 * drops the visitor into the workspace without an account.
 *
 * Inherits the active theme automatically (themes are applied on <html
 * data-theme>), so every --wf- token here themes with the rest of the app.
 */
@Component({
  selector: 'wf-auth',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  private auth = inject(AuthStore);
  private guest = inject(GuestModeService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected tagline = inject(TaglineService);
 
  protected mode = signal<Mode>(this.route.snapshot.data['mode'] === 'signup' ? 'signup' : 'login');
 
  protected email = signal('');
  protected password = signal('');
  protected displayName = signal('');
  protected consent = signal(false);
  protected showPassword = signal(false);
  protected submitting = signal(false);
  protected errorMsg = signal<string | null>(null);

  // live password rules — mirror the backend complexity rule exactly
  protected pwRules = computed(() => {
    const v = this.password();
    return {
      len: v.length >= 8,
      up: /[A-Z]/.test(v),
      low: /[a-z]/.test(v),
      num: /\d/.test(v),
      sp: /[^A-Za-z0-9]/.test(v),
    };
  });
  protected pwAllMet = computed(() => Object.values(this.pwRules()).every(Boolean));
 
  protected canSubmit = computed(() => {
    if (this.submitting()) return false;
    if (!this.email().trim() || !this.password()) return false;
    if (this.mode() === 'signup') return this.pwAllMet() && this.consent();
    return true;
  });

  protected isSignup = computed(() => this.mode() === 'signup');
 
  protected toggleMode(): void {
    this.errorMsg.set(null);
    this.mode.update((m) => (m === 'login' ? 'signup' : 'login'));
  }
 
  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.errorMsg.set(null);
    try {
      if (this.mode() === 'signup') {
        await this.auth.signup(this.email().trim(), this.password(), this.displayName().trim() || undefined);
      } else {
        await this.auth.login(this.email().trim(), this.password());
      }
      // A real session now exists — make sure any prior guest choice is cleared.
      this.guest.clear();
      this.router.navigate(['/']);
    } catch {
      this.errorMsg.set(
        this.mode() === 'signup'
          ? 'Could not create your account. That email may already be registered.'
          : 'Invalid email or password.'
      );
    } finally {
      this.submitting.set(false);
    }
  }
 
  protected continueAsGuest(): void {
    this.guest.enterAsGuest();
    this.router.navigate(['/']);
  }
 
  // helpers for signal-bound inputs
  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }
}