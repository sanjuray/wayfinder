import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TaglineService } from '../../core/services/tagline.service';
import { AppStateStore } from '../../core/stores/app-state.store';

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

  /**
   * "saved" if recently backed up, "unsaved" if never or overdue.
   */
  protected backupStatusLabel = computed<string>(() => {
    const last = this.appState.lastBackupAt();
    if (!last) return 'unsaved';
    return this.backupIsStale() ? 'unsaved' : 'saved';
  });

  protected backupStatusTooltip = computed<string>(() => {
    const last = this.appState.lastBackupAt();
    if (!last) return 'No backups yet. Export from Settings.';
    const days = Math.floor(
      (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days === 0) return 'Last backup: today';
    if (days === 1) return 'Last backup: yesterday';
    return `Last backup: ${days} days ago`;
  });

  protected backupIsStale = computed<boolean>(() => {
    const last = this.appState.lastBackupAt();
    if (!last) return true;
    const freq = this.appState.autoBackupFrequency();
    if (freq === 'never') return false;
    const days = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
    const threshold = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 30;
    return days > threshold;
  });
}