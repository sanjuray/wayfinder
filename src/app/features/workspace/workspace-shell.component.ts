import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TaglineService } from '../../core/services/tagline.service';
import { AppStateStore } from '../../core/stores/app-state.store';
import { SearchStateService } from '../../core/services/search-state.service';

/**
 * Persistent workspace chrome — topbar with brand, nav tabs, save-status and
 * settings gear. Holds a <router-outlet> for the active workspace route
 * (map / collections / trips and their detail children).
 *
 * Settings is NOT a child of this shell — it's a top-level route with its own
 * breadcrumb-based layout (see mockup screen-settings).
 */
@Component({
  selector: 'wf-workspace-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './workspace-shell.component.html',
  styleUrl: './workspace-shell.component.css',
})
export class WorkspaceShellComponent {
  protected tagline = inject(TaglineService);
  protected appState = inject(AppStateStore);
  protected search = inject(SearchStateService);

  /**
   * Whether the user has data changes that haven't been backed up yet.
   * True when lastChangeAt is more recent than lastBackupAt, OR when
   * lastChangeAt exists but no backup has ever happened.
   *
   * This is the primary driver of the saved/unsaved indicator and
   * replaces the previous time-based "staleness" heuristic (which
   * dishonestly showed "unsaved" after N days of inactivity even if no
   * real changes had occurred).
   */
  protected hasUnsavedChanges = computed<boolean>(() => {
    const lastChange = this.appState.lastChangeAt();
    if (!lastChange) return false;
    const lastBackup = this.appState.lastBackupAt();
    if (!lastBackup) return true;
    return lastChange > lastBackup;
  });

  /**
   * "saved" when there are no un-backed-up changes; "unsaved" otherwise.
   */
  protected backupStatusLabel = computed<string>(() =>
    this.hasUnsavedChanges() ? 'unsaved' : 'saved'
  );

  protected backupStatusTooltip = computed<string>(() => {
    if (this.hasUnsavedChanges()) {
      const lastChange = this.appState.lastChangeAt();
      return lastChange
        ? `You have unsaved changes since ${formatRelative(lastChange)}. Export from Settings to back up.`
        : 'You have unsaved changes. Export from Settings to back up.';
    }
    const last = this.appState.lastBackupAt();
    if (!last) return 'No backups yet, but no changes to back up.';
    return `Last backup: ${formatRelative(last)}`;
  });
}

/**
 * Short relative-time formatter for the saved-status tooltip. Returns
 * "today", "yesterday", "3 days ago", "2 weeks ago", etc. Tolerant of
 * invalid input — falls back to "recently".
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const diffMs = Math.max(0, Date.now() - then);
  const day = 86_400_000;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}