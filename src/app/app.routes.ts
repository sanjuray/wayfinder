import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
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
      import('./features/trips/trips-so-far.component').then((m) => m.TripsSoFarComponent),
  },
  {
    path: 'trips/:id',
    loadComponent: () =>
      import('./features/trips/trip-plan.component').then((m) => m.TripPlanComponent),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', redirectTo: '' },
];