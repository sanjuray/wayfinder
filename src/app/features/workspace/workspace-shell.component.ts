import { Component, inject, computed, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
 
import { TaglineService } from '../../core/services/tagline.service';
import { AppStateStore } from '../../core/stores/app-state.store';
import { SearchStateService } from '../../core/services/search-state.service';
import { BackupService } from '../../core/services/backup.service';
import { AuthStore } from '../../core/stores/auth.store';
 
/**
 * Persistent workspace chrome — topbar with brand, nav tabs, saved-status
 * (with a hover popover), search toggle, and the account pill/menu (or a
 * guest cluster when signed out). Holds a <router-outlet> for the active
 * workspace route.
 *
 * Settings is NOT a child of this shell — it's a top-level route. The
 * account menu items deep-link into it (/settings?section=...).
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
  protected auth = inject(AuthStore);
  private backup = inject(BackupService);
  private router = inject(Router);

  /** Account dropdown open/closed. */
  protected menuOpen = signal(false);
  /** Saved-status popover click-to-pin (hover also opens it via CSS). */
  protected backupPopOpen = signal(false);
 
  // ---- saved / unsaved indicator (unchanged logic) ----
  protected hasUnsavedChanges = computed<boolean>(() => {
    const lastChange = this.appState.lastChangeAt();
    if (!lastChange) return false;
    const lastBackup = this.appState.lastBackupAt();
    if (!lastBackup) return true;
    return lastChange > lastBackup;
  });
 
  protected backupStatusLabel = computed<string>(() =>
    this.hasUnsavedChanges() ? 'unsaved' : 'saved'
  );

  protected backupStatusTooltip = computed<string>(() => {
    if (this.hasUnsavedChanges()) {
      const lastChange = this.appState.lastChangeAt();
      return lastChange
        ? `You have unsaved changes since ${formatRelative(lastChange)}.`
        : 'You have unsaved changes.';
    }
    const last = this.appState.lastBackupAt();
    if (!last) return 'No backups yet, but no changes to back up.';
    return `Last backup: ${formatRelative(last)}`;
  });
 
  /** Relative-time label for the JSON-export row in the popover. */
  protected jsonExportLabel = computed<string>(() => {
    const last = this.appState.lastBackupAt();
    return last ? formatRelative(last) : 'never';
  });

  /**
   * Backend-sync status label. STUB — the sync backend isn't wired yet, so
   * this deliberately never claims a real sync happened. Once a real
   * lastSyncedAt lands on AppState (and a sync loop exists), replace the
   * body with the same formatRelative() treatment as JSON export.
   */
  protected syncStatusLabel = computed<string>(() => {
    if (!this.auth.isLoggedIn()) return 'sign in to sync';
    return 'not synced yet'; // STUB: no sync backend yet
  });

  // ---- actions ----
 
  /** Real JSON export — shared with the Settings page via BackupService. */
  protected async exportJson(): Promise<void> {
    try {
      await this.backup.exportJson();
    } catch {
      /* surfaced elsewhere; popover stays quiet */
    }
    this.backupPopOpen.set(false);
  }
 
  /**
   * Backend sync trigger. STUB — intentionally does nothing yet except
   * close the popover. Wiring target: call a SyncService.syncNow() that
   * pushes/pulls against the backend and stamps AppState.lastSyncedAt.
   * Left as a no-op (not a fake success) so nothing here lies about state.
   */
  protected syncNow(): void {
    // TODO(sync): call SyncService.syncNow() once the sync loop exists.
    this.backupPopOpen.set(false);
  }
 
  protected toggleSearch(): void {
    this.search.toggle();
  }
 
  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.backupPopOpen.set(false);        // the two panels are mutually exclusive
    this.menuOpen.update((v) => !v);
  }
 
  protected toggleBackupPop(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);             // close the account menu if it was open
    this.backupPopOpen.update((v) => !v);
  }

  protected goToSettings(section?: string): void {
    this.menuOpen.set(false);
    this.router.navigate(['/settings'], section ? { queryParams: { section } } : {});
  }
 
  protected async logout(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
 
  // ---- outside-click / escape close ----
  @HostListener('document:click')
  protected onDocClick(): void {
    if (this.menuOpen()) this.menuOpen.set(false);
    if (this.backupPopOpen()) this.backupPopOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.menuOpen.set(false);
    this.backupPopOpen.set(false);
    if (this.search.isOpen()) this.search.close();
  }
}
 
/**
 * Short relative-time formatter. "today", "yesterday", "3 days ago", etc.
 * Tolerant of invalid input — falls back to "recently".
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