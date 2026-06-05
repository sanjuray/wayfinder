import { Injectable, signal } from '@angular/core';

/**
 * Tiny singleton that holds the search bar's open/closed state.
 *
 * Why a service instead of signals on each component:
 *   - The toggle button lives in WorkspaceShellComponent (topbar).
 *   - The search bar UI lives in HomeComponent (over the map) and
 *     PlacesListComponent (at the top of the list).
 *   - These are not parent-child — they're siblings under the shell.
 *   - A shared service is the standard Angular solution for cross-
 *     sibling state without a prop-drilling chain.
 *
 * Keeps no query state — each consumer owns its own query signal.
 * The service is purely about "is the search experience visible."
 */
@Injectable({ providedIn: 'root' })
export class SearchStateService {
  readonly isOpen = signal(false);

  open(): void {
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  toggle(): void {
    this.isOpen.update((v) => !v);
  }
}