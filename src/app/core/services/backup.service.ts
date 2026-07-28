import { inject, Injectable } from '@angular/core';
import { STORAGE_ADAPTER } from '../storage/storage.token';
import { AppStateStore } from '../stores/app-state.store';

/**
 * The one place the JSON backup/export flow lives, so it can be triggered
 * from BOTH the Settings page and the topbar saved-status popover without
 * duplicating the Blob/download/recordBackup dance.
 */
@Injectable({ providedIn: 'root' })
export class BackupService {
  private storage = inject(STORAGE_ADAPTER);
  private appState = inject(AppStateStore);

  async exportJson(): Promise<void> {
    const jsonRaw = await this.storage.exportAll();
    const json = JSON.stringify(jsonRaw, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `wayfinder-export-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    await this.appState.recordBackup();
  }
}