import { Component, inject, computed, signal, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
 
import { TaglineService } from '../../core/services/tagline.service';
import { AppStateStore } from '../../core/stores/app-state.store';
import { SearchStateService } from '../../core/services/search-state.service';
import { BackupService } from '../../core/services/backup.service';
import { AuthStore } from '../../core/stores/auth.store';
import { SyncService } from '../../core/services/sync.service';
 
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
  protected sync = inject(SyncService);

  /** Account dropdown open/closed. */
  protected menuOpen = signal(false);
  /** Saved-status popover click-to-pin (hover also opens it via CSS). */
  protected backupPopOpen = signal(false);
 
  // ---- saved / unsaved indicator ----
  // The topbar dot now reflects BACKEND SYNC state (not local export). It's
  // only meaningful for logged-in users; guests don't see the button at all
  // (see showSaveStatus + the template @if).
 
  /** Whether to render the save-status button. Hidden entirely for guests. */
  protected showSaveStatus = computed<boolean>(() => this.auth.isLoggedIn());
 
  /**
   * True when the user has local changes that haven't reached the server yet —
   * i.e. something changed since the last successful sync. Drives the "stale"
   * (amber) dot. Distinct from a sync *error*, which is handled separately.
   */
  protected hasUnsyncedChanges = computed<boolean>(() => {
    const lastChange = this.appState.lastChangeAt();
    if (!lastChange) return false;
    const lastSync = this.appState.lastSyncedAt();
    if (!lastSync) return true;            // never synced but has changes
    return lastChange > lastSync;
  });
 
  /**
   * The green "in sync" state: logged in, not mid-sync, no error, and no
   * changes waiting to go up. This is what turns the dot green.
   */
  protected isSynced = computed<boolean>(() => {
    if (!this.auth.isLoggedIn()) return false;
    if (this.sync.status() !== 'idle') return false;
    if (this.hasUnsyncedChanges()) return false;
    return !!this.appState.lastSyncedAt();
  });
  
  /** Short label on the button itself. */
  protected backupStatusLabel = computed<string>(() => {
    const status = this.sync.status();
    if (status === 'syncing') return 'syncing…';
    if (status === 'error') return 'sync failed';
    if (this.hasUnsyncedChanges()) return 'unsynced';
    return this.appState.lastSyncedAt() ? 'synced' : 'not synced';
  });

  /** Hover/title tooltip on the button. */
  protected backupStatusTooltip = computed<string>(() => {
    const status = this.sync.status();
    if (status === 'syncing') return 'Syncing with the server…';
    if (status === 'error') {
      return `Sync failed — ${this.sync.lastError() ?? 'unknown error'}. It'll retry automatically.`;
    }
    if (this.hasUnsyncedChanges()) {
      const lastChange = this.appState.lastChangeAt();
      return lastChange
        ? `You have changes not yet synced (since ${formatRelative(lastChange)}).`
        : 'You have changes not yet synced.';
    }
    const last = this.appState.lastSyncedAt();
    return last ? `Last synced ${formatRelative(last)}` : 'Not synced yet.';
  });

  /**
   * Sync status line shown inside the popover (the "Backend sync" row).
   * Prefers a precise relative time for the last successful sync.
   */
  protected syncStatusLabel = computed<string>(() => {
    if (!this.auth.isLoggedIn()) return 'sign in to sync';
    const status = this.sync.status();
    if (status === 'syncing') return 'syncing…';
    if (status === 'error') return `failed — ${this.sync.lastError() ?? 'unknown error'}`;
    const last = this.appState.lastSyncedAt();
    return last ? `synced ${formatRelative(last)}` : 'not synced yet';
  });
 
  /**
   * Last-backup line for the JSON-export row. Now shows an absolute date WITH
   * time when a backup exists (e.g. "Jul 31, 2026, 4:12 PM"), per request —
   * the day alone was too coarse to tell recent exports apart.
   */
  protected jsonExportLabel = computed<string>(() => {
    const last = this.appState.lastBackupAt();
    return last ? formatRelative(last) : 'never';
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
   * Triggers a push → pull sync cycle via SyncService.
   * Re-entrant calls while syncing are silently ignored (SyncService gates them).
   * Only fires for logged-in users — guest taps do nothing.
   */
  protected syncNow(): void {
    if (!this.auth.isLoggedIn()) return;
    void this.sync.syncNow();
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
 * Absolute date+time formatter for the last-backup line, e.g.
 * "Jul 31, 2026, 4:12 PM". Uses the browser locale. Falls back to the raw
 * string if it can't be parsed.
 */
function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
 
/**
 * Short relative-time formatter with sub-day resolution, so recent events read
 * as "just now" / "3 min ago" / "2 hours ago" rather than collapsing to
 * "today". Falls back to today/yesterday/days/weeks/months/years for older
 * timestamps. Tolerant of invalid input — falls back to "recently".
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'recently';
  const diffMs = Math.max(0, Date.now() - then);
 
  const min = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
 
  if (diffMs < 45_000) return 'just now';
  if (diffMs < hour) {
    const m = Math.round(diffMs / min);
    return `${m} min ago`;
  }
  if (diffMs < day) {
    const h = Math.round(diffMs / hour);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffMs < 2 * day) return 'yesterday';
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}