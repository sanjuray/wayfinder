import { Routes } from '@angular/router';

/**
 * Routing structure:
 *
 * /                       WorkspaceShell (topbar always visible)
 *   ├── ''                HomeComponent       (map + sidebar)
 *   ├── 'collections'     CollectionsList
 *   ├── 'collections/:id' CollectionDetail
 *   ├── 'trips'           TripsSoFar
 *   └── 'trips/:id'       TripPlan
 *
 * /settings               SettingsComponent   (own breadcrumb layout — no shell topbar)
 *
 * Settings sits outside the shell deliberately. The mockup uses a breadcrumb-
 * style header for Settings, not the workspace topbar — see screen-settings in
 * the mockup. Clicking the gear in the topbar is a "leave the workspace" gesture.
 */
export const routes: Routes = [
  {
    path: '',
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
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];