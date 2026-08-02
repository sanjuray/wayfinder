import { Routes } from '@angular/router';
import { sessionGuard } from './core/guards/session.guard';

/**
 * Routing structure:
 *
 * /login, /signup         AuthComponent (outside the shell - no topbar)
 * 
 * /                       WorkspaceShell (canActivate: sessinoGuard)
 *   ├── ''                HomeComponent       (map + sidebar)
 *   ├── 'collections'     CollectionsList
 *   ├── 'collections/:id' CollectionDetail
 *   ├── 'places'          PlacesList         [Phase 5]
 *   ├── 'trips'           TripsSoFar
 *   └── 'trips/:id'       TripPlan
 *
 * /settings               SettingsComponent   (own breadcrumb layout — no shell topbar)
 *
 * Settings sits outside the shell deliberately. The mockup uses a breadcrumb-
 * style header for Settings, not the workspace topbar — see screen-settings in
 * the mockup. Clicking the gear in the topbar is a "leave the workspace" gesture.
 * 
 * sessionGuard implements the "landing choice": a visitor with no session and
 * no guest-mode opt-in is redirected to /login, which offers log in/ sign up/ continue as guest. 
 * Anyone logged in OR in guest mode passes straight through.
 */
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/auth.component').then((m) => m.AuthComponent),
    data: {mode: 'login'},
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/auth.component').then((m) => m.AuthComponent),
    data: {mode: 'signup'},
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/reset-password.component').then((m) => m.ResetPasswordComponent),
  },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./features/privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help-guide/help-guide.component').then((m) => m.HelpGuideComponent),
  },
  {
    path: '',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/workspace/workspace-shell.component').then(
        (m) => m.WorkspaceShellComponent
      ),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/home/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'collections',
        loadComponent: () =>
          import('./features/collections/collections-list.component').then(
            (m) => m.CollectionsListComponent
          ),
      },
      {
        path: 'collections/:id',
        loadComponent: () =>
          import('./features/collections/collection-detail.component').then(
            (m) => m.CollectionDetailComponent
          ),
      },
      {
        path: 'places',
        loadComponent: () =>
          import('./features/places/places-list/places-list.component').then(
            (m) => m.PlacesListComponent
          ),
      },
      {
        path: 'trips',
        loadComponent: () =>
          import('./features/trips/trips-so-far.component').then(
            (m) => m.TripsSoFarComponent
          ),
      },
      {
        path: 'trips/:id',
        loadComponent: () =>
          import('./features/trips/trip-plan.component').then((m) => m.TripPlanComponent),
      },
    ],
  },
  {
    path: 'settings',
    canActivate: [sessionGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];