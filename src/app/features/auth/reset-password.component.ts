import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../core/stores/auth.store';
 
/**
 * Reset-password page. Reached from the link in the reset email:
 *   /reset-password?token=xxxxx
 *
 * Reads the token from the query string, collects a new password (with the
 * same complexity rules the signup form shows), and submits both to the
 * backend. On success it routes to /login. On an invalid/expired token the
 * backend returns 400 and we show a recoverable error with a link to request
 * a fresh reset.
 *
 * Standalone and self-styled so it doesn't depend on the auth component — it's
 * a different entry point (email link, no session) with its own tiny surface.
 */
@Component({
  selector: 'wf-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="reset-screen">
      <div class="reset-card">
        <div class="logo">
          <svg width="30" height="34" viewBox="0 0 42 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 2 C9.95 2 1 10.95 1 22 C1 36 21 46 21 46 C21 46 41 36 41 22 C41 10.95 32.05 2 21 2 Z"
              fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round" style="color: var(--wf-ink)" />
            <path d="M21 11 L23 19 L31 21 L23 23 L21 31 L19 23 L11 21 L19 19 Z" fill="var(--wf-accent)" />
            <circle cx="21" cy="21" r="2.2" fill="var(--wf-bg)" />
          </svg>
          <span class="brand-name">wayfinder</span>
        </div>
 
        @if (done()) {
          <h1 class="h">Password updated</h1>
          <p class="sub">Your password's been changed. You can log in with it now.</p>
          <button type="button" class="submit-btn" (click)="goLogin()">Go to log in</button>
        } @else if (!token()) {
          <h1 class="h">Link looks broken</h1>
          <p class="sub">This reset link is missing its token. Request a fresh one and try again.</p>
          <a class="submit-btn as-link" routerLink="/login">Back to log in</a>
        } @else {
          <h1 class="h">Set a new password</h1>
          <p class="sub">Choose a new password for your account.</p>
 
          @if (errorMsg()) {
            <div class="form-error" role="alert">{{ errorMsg() }}</div>
          }
 
          <div class="field">
            <label for="np">New password</label>
            <div class="pw-wrap">
              <input id="np" [type]="show() ? 'text' : 'password'"
                     autocomplete="new-password" placeholder="••••••••"
                     [value]="password()" (input)="password.set(val($event))"
                     (keyup.enter)="submit()" />
              <button type="button" class="peek" (click)="show.set(!show())"
                      [attr.aria-label]="show() ? 'Hide password' : 'Show password'">
                {{ show() ? 'Hide' : 'Show' }}
              </button>
            </div>
            <div class="pw-req">
              <span class="req" [class.ok]="rules().len">8+ chars</span>
              <span class="req" [class.ok]="rules().up">uppercase</span>
              <span class="req" [class.ok]="rules().low">lowercase</span>
              <span class="req" [class.ok]="rules().num">digit</span>
              <span class="req" [class.ok]="rules().sp">symbol</span>
            </div>
          </div>
          <button type="button" class="submit-btn" [disabled]="!canSubmit()" (click)="submit()">
            {{ submitting() ? 'One moment…' : 'Update password' }}
          </button>
 
          <div class="switch">
            <a class="link" routerLink="/login">Back to log in</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .reset-screen {
      min-height: 100vh; min-height: 100dvh;
      display: flex; align-items: center; justify-content: center;
      padding: 44px; background: var(--wf-bg); color: var(--wf-ink);
      font-family: var(--wf-font-body);
    }
    .reset-card { width: 100%; max-width: 360px; }
    .logo { display: flex; align-items: center; gap: 8px; margin-bottom: 26px; }
    .brand-name {
      font-family: var(--wf-font-display); font-weight: 600; font-size: 18px;
      letter-spacing: -0.3px;
    }
    .h {
      font-family: var(--wf-font-display); font-weight: 600;
      font-size: 26px; letter-spacing: -0.5px; margin: 0 0 8px;
    }
    .sub { font-size: 13px; color: var(--wf-ink-soft); margin: 0 0 22px; line-height: 1.55; }
    .form-error {
      background: color-mix(in srgb, var(--wf-accent) 12%, transparent);
      border: 0.5px solid color-mix(in srgb, var(--wf-accent) 40%, transparent);
      color: var(--wf-accent);
      border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px;
    }
    .field { margin-bottom: 14px; }
    .field label {
      display: block; font-size: 12px; font-weight: 600;
      color: var(--wf-ink-soft); margin-bottom: 6px;
    }
    .pw-wrap { position: relative; display: flex; align-items: center; }
    .pw-wrap input {
      width: 100%; padding: 11px 60px 11px 12px;
      border-radius: 10px; border: 0.5px solid var(--wf-hairline);
      background: var(--wf-bg-2); font: inherit; font-size: 14px; color: var(--wf-ink);
    }
    .pw-wrap input::placeholder { color: var(--wf-ink-faint); }
    .pw-wrap input:focus { outline: none; border-color: var(--wf-accent); box-shadow: var(--wf-glow); }
    .peek {
      position: absolute; right: 10px; background: none; border: none;
      color: var(--wf-ink-faint); font: inherit; font-size: 12px; cursor: pointer;
    }
    .peek:hover { color: var(--wf-ink-soft); }
    .pw-req { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .pw-req .req {
      font-size: 11px; padding: 3px 8px; border-radius: 20px;
      background: var(--wf-bg-2); color: var(--wf-ink-faint);
      border: 0.5px solid var(--wf-hairline);
    }
    .pw-req .req.ok {
      background: color-mix(in srgb, var(--wf-teal) 15%, transparent);
      color: var(--wf-teal); border-color: transparent;
    }
    .submit-btn {
      width: 100%; margin-top: 8px; padding: 12px;
      border-radius: var(--wf-radius-pill, 24px); border: none;
      background: var(--wf-accent); color: var(--wf-bg);
      font: inherit; font-weight: 600; font-size: 14px; cursor: pointer;
      box-shadow: var(--wf-glow); transition: opacity 0.15s;
      text-align: center; text-decoration: none; display: block;
    }
    .submit-btn.as-link { line-height: 1.2; }
    .submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .switch { text-align: center; margin-top: 18px; font-size: 13px; color: var(--wf-ink-soft); }
    .link { color: var(--wf-accent); text-decoration: none; font-weight: 500; }
    .link:hover { text-decoration: underline; }
  `],
})
export class ResetPasswordComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthStore);
 
  protected token = signal<string>(this.route.snapshot.queryParamMap.get('token') ?? '');
  protected password = signal('');
  protected show = signal(false);
  protected submitting = signal(false);
  protected errorMsg = signal<string | null>(null);
  protected done = signal(false);

  protected rules = computed(() => {
    const p = this.password();
    // Special char = any non-alphanumeric. Simpler and safer than a literal
    // character class (which would need a backtick inside this component's
    // template literal). Matches the backend's intent: "a special character".
    const hasSpecial = /[^A-Za-z0-9]/.test(p);
    return {
      len: p.length >= 8,
      up: /[A-Z]/.test(p),
      low: /[a-z]/.test(p),
      num: /\d/.test(p),
      sp: hasSpecial,
    };
  });
  protected allMet = computed(() => Object.values(this.rules()).every(Boolean));
  protected canSubmit = computed(() => !this.submitting() && this.allMet());
 
  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.errorMsg.set(null);
    try {
      await this.auth.resetPassword(this.token(), this.password());
      this.done.set(true);
    } catch {
      this.errorMsg.set('This reset link is invalid or has expired. Request a new one from the login page.');
    } finally {
      this.submitting.set(false);
    }
  }
 
  protected goLogin(): void {
    this.router.navigate(['/login']);
  }
}
