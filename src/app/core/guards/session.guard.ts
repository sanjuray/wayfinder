import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../stores/auth.store';
import { GuestModeService } from '../services/guest-mode.service';

export const sessionGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const guest = inject(GuestModeService);
  const router = inject(Router);

  if (auth.isLoggedIn() || guest.isGuest()) return true;
  return router.createUrlTree(['/login']);
};
