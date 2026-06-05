import {
  Component,
  inject,
  signal,
  computed,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CollectionsStore } from '../../core/stores/collections.store';
import { PlacesStore } from '../../core/stores/places.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { VibeTagsStore } from '../../core/stores/vibe-tags.store';
import { AppStateStore } from '../../core/stores/app-state.store';
import { STORAGE_ADAPTER } from '../../core/storage/storage.token';
import { IconPickerComponent } from '../../shared/icon-picker/icon-picker.component';
import { CategoryManagerComponent } from '../../shared/category-manager/category-manager.component';
import { VibeTagManagerComponent } from '../../shared/vibe-tag-manager/vibe-tag-manager.component';
import { gradientCss, DEFAULT_COVER_ICON } from '../../core/constants/collection-covers';
import type { ThemeName, AppState } from '../../core/models';

type SettingsSection =
  | 'categories'
  | 'collections'
  | 'theme'
  | 'storage'
  | 'about'
  | 'advanced';

interface ThemeTile {
  id: ThemeName;
  name: string;
  swatches: string[];
  desc: string;
}

@Component({
  selector: 'wf-settings',
  standalone: true,
  imports: [FormsModule, IconPickerComponent, CategoryManagerComponent, VibeTagManagerComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">

      <!-- breadcrumb -->
      <div class="breadcrumb">
        <div class="breadcrumb-inner">
          <button class="back" (click)="onBack()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M5 12l6-6M5 12l6 6"/>
            </svg>
            back to map
          </button>
          <span class="sep">/</span>
          <span class="title">Settings</span>
        </div>
      </div>

      <div class="set-wrap" #scrollHost>
        <div class="set-grid">

          <!-- LEFT NAV -->
          <div class="set-nav">
            @for (item of navItems; track item.id) {
              <button
                [class.active]="activeSection() === item.id"
                [class.adv-nav]="item.id === 'advanced'"
                (click)="scrollToSection(item.id)"
              >
                <i class="ti" [class]="'ti-' + item.icon"></i>
                {{ item.label }}
              </button>
            }
          </div>

          <!-- RIGHT BODY: all sections rendered, sidebar scrolls to each -->
          <div class="set-body">

            <!-- ===== CATEGORIES & VIBES ===== -->
            <section #section id="section-categories" data-section="categories">
              <div class="set-card">
                <wf-category-manager />
              </div>

              <div class="set-card">
                <wf-vibe-tag-manager />
              </div>
            </section>

            <!-- ===== COLLECTIONS ===== -->
            <section #section id="section-collections" data-section="collections">
              <div class="set-card">
                <h3>Collections</h3>
                <div class="desc">
                  Group your places into named sets. A place can belong to many collections.
                </div>

                @if (collections.entities().length === 0) {
                  <p class="empty-hint">No collections yet. Create one below.</p>
                } @else {
                  <ul class="col-list">
                    @for (c of collections.entities(); track c.id) {
                      <li class="col-item">
                        @if (editingCollectionId() === c.id) {
                          <button
                            class="col-cover"
                            [style.background]="coverGradientFor(c)"
                            (click)="openIconPickerFor(c.id)"
                            aria-label="Change icon"
                            title="Change icon"
                          >
                            <i class="ti" [class]="'ti-' + (c.coverIcon || defaultCoverIcon)"></i>
                          </button>
                          <input
                            class="col-input"
                            [ngModel]="editingCollectionName()"
                            (ngModelChange)="editingCollectionName.set($event)"
                            (keydown.enter)="saveCollectionEdit()"
                            (keydown.escape)="cancelCollectionEdit()"
                            autofocus
                          />
                          <button class="link" (click)="cancelCollectionEdit()">Cancel</button>
                          <button class="link primary" (click)="saveCollectionEdit()">Save</button>
                      } @else {
                        <button
                          class="col-cover"
                          [style.background]="coverGradientFor(c)"
                          (click)="openIconPickerFor(c.id)"
                          aria-label="Change icon"
                          title="Change icon"
                        >
                          <i class="ti" [class]="'ti-' + (c.coverIcon || defaultCoverIcon)"></i>
                        </button>
                        <span class="col-name">{{ c.name }}</span>
                        <span class="col-count">
                          {{ placesInCollection(c.id) }}
                          place{{ placesInCollection(c.id) === 1 ? '' : 's' }}
                        </span>
                        
                        <!-- Phase 4 (e): Open in detail view -->
                        <a
                          class="col-open"
                          [routerLink]="['/collections', c.id]"
                          aria-label="Open collection"
                          title="Open collection"
                        >
                          Open <i class="ti ti-arrow-up-right"></i>
                        </a>
                        
                        <button
                          class="icon-btn"
                          (click)="startEditCollection(c.id, c.name)"
                          aria-label="Rename"
                        >
                          <i class="ti ti-pencil"></i>
                        </button>
                        <button
                          class="icon-btn danger"
                          (click)="deleteCollection(c.id)"
                          aria-label="Delete"
                        >
                          <i class="ti ti-trash"></i>
                        </button>
                        }
                      </li>
                    }
                  </ul>
                }

                <div class="create-row">
                  <input
                    class="col-input"
                    [ngModel]="newCollectionName()"
                    (ngModelChange)="newCollectionName.set($event)"
                    (keydown.enter)="createCollection()"
                    placeholder="New collection name…"
                  />
                  <button
                    class="btn primary"
                    [disabled]="!newCollectionName().trim()"
                    (click)="createCollection()"
                  >
                    Create
                  </button>
                </div>
              </div>
            </section>

            <!-- ===== THEME ===== -->
            <section #section id="section-theme" data-section="theme">
              <div class="set-card">
                <h3>Theme</h3>
                <div class="desc">
                  Seven themes. Switch any time — the whole app re-renders live.
                </div>
                <div class="theme-grid">
                  @for (t of themes; track t.id) {
                    <button
                      class="theme-tile"
                      [class.active]="appState.themePreference() === t.id"
                      (click)="setTheme(t.id)"
                      [attr.aria-label]="t.name"
                      [title]="t.name"
                    >
                      <div class="swatches">
                        @for (sw of t.swatches; track sw) {
                          <span [style.background]="sw"></span>
                        }
                      </div>
                      <div class="nm">{{ t.name }}</div>
                      <div class="theme-desc">{{ t.desc }}</div>
                    </button>
                  }
                </div>
              </div>
            </section>

            <!-- ===== STORAGE & BACKUP ===== -->
            <section #section id="section-storage" data-section="storage">
              <div class="set-card">
                <h3>Storage &amp; backup</h3>
                <div class="desc">
                  Wayfinder is saving everything to this browser's local database.
                  <strong>Last backup: {{ lastBackupLabel() }}.</strong>
                </div>

                <div class="folder-info">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="var(--wf-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <ellipse cx="12" cy="6" rx="8" ry="3"/>
                    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>
                    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>
                  </svg>
                  <div class="folder-text">
                    <div>Browser storage (IndexedDB)</div>
                    <div class="path">
                      {{ placeCount() }} places · {{ collections.entities().length }} collections
                    </div>
                  </div>
                  <button class="btn change" disabled title="Coming soon">
                    Set up folder backups
                  </button>
                </div>

                <div class="backup-actions">
                  <button class="btn primary" (click)="exportData()">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                    </svg>
                    Export backup now
                  </button>
                  <label class="btn import-label">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    Import from file
                    <input
                      type="file"
                      accept=".json"
                      class="file-input"
                      (change)="onImportFile($event)"
                    />
                  </label>
                  <div class="backup-freq">
                    <label class="freq-label">Auto-backup</label>
                    <select
                      class="freq-select"
                      [ngModel]="appState.autoBackupFrequency()"
                      (ngModelChange)="setAutoBackupFreq($event)"
                    >
                      <option value="never">Never</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                @if (importResult()) {
                  <p class="import-feedback" [class.err]="importResult()!.startsWith('Error')">
                    {{ importResult() }}
                  </p>
                }

                <div class="danger-zone">
                  <h4>Danger zone</h4>
                  <p>
                    Clearing data removes all places, collections, and visits from this device.
                    This cannot be undone.
                  </p>
                  <button class="btn danger" (click)="confirmClearAll()">
                    Clear all data
                  </button>
                </div>
              </div>
            </section>

            <!-- ===== ABOUT ===== -->
            <section #section id="section-about" data-section="about">
              <div class="set-card">
                <h3>About Wayfinder</h3>
                <p class="lead">Wayfinder is for everyone in between.</p>
                <p class="prose">
                  For the enthusiastic and the lazy. For ambitious visionary planners
                  and the hard-to-move homebodies with glimpses of hope. For the seasoned
                  wanderer and the once-in-a-while explorer. For anyone collecting places
                  they mean to go.
                </p>
                <p class="prose">
                  Wayfinder doesn't push. It pins. It plans. It taunts when you need it,
                  encourages when you don't, and stays quiet when you just want to look at the map.
                </p>
                <p class="prose">
                  Built for fellow travelers — hoping this helps in your journey.
                </p>
                <p class="legal">
                  Made with care. No servers. No ads. No telemetry.
                  Version 1.0.0 · 2026.
                </p>
              </div>

              <div class="set-card">
                <h3>Credits</h3>
                <div class="credit-row">
                  <span class="credit-label">Map data</span>
                  <a class="credit-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
                    © OpenStreetMap contributors
                  </a>
                </div>
                <div class="credit-row">
                  <span class="credit-label">Geocoding</span>
                  <a class="credit-link" href="https://nominatim.org" target="_blank" rel="noopener">
                    Nominatim / OSM
                  </a>
                </div>
                <div class="credit-row">
                  <span class="credit-label">Built with</span>
                  <span class="credit-val">Angular · Leaflet · Dexie · ngrx/signals</span>
                </div>
              </div>
            </section>

            <!-- ===== ADVANCED ===== -->
            <section #section id="section-advanced" data-section="advanced">
              <div class="set-card">
                <h3>Behavior</h3>
                <div class="desc">Fine-grained control over what Wayfinder does on its own.</div>
                <p class="hint">More controls coming as features land. Map provider selection
                and dusk-shift toggle will live here.</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>

    @if (iconPickerForCollectionId(); as collectionId) {
      <wf-icon-picker
        (picked)="onIconPicked(collectionId, $event)"
        (cancelled)="closeIconPicker()"
      />
    }

  `,
  styles: [
    `
      .wrap {
        height: 100vh;
        overflow-y: auto;
        background: var(--wf-bg);
      }

      /* breadcrumb */
      .breadcrumb {
        border-bottom: 0.5px solid var(--wf-hairline);
        position: sticky;
        top: 0;
        background: var(--wf-bg);
        z-index: 10;
      }
      .breadcrumb-inner {
        max-width: 960px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 14px 22px;
      }
      .back {
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--wf-ink-soft);
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        border-radius: 8px;
        font-weight: 500;
        transition: all 0.2s;
      }
      .back:hover {
        background: var(--wf-hairline);
        color: var(--wf-ink);
      }
      .sep { color: var(--wf-ink-faint); }
      .title {
        font-family: var(--wf-font-display);
        font-size: 20px;
        color: var(--wf-ink);
        font-weight: 500;
        letter-spacing: -0.3px;
      }

      /* layout — centered with max-width */
      .set-wrap {
        padding: 24px 22px 80px;
      }
      .set-grid {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 32px;
        max-width: 960px;
        margin: 0 auto;
      }

      /* sticky left nav */
      .set-nav {
        display: flex;
        flex-direction: column;
        gap: 3px;
        position: sticky;
        top: 80px;
        align-self: start;
      }
      .set-nav button {
        text-align: left;
        padding: 10px 14px;
        border-radius: 10px;
        border: none;
        background: transparent;
        font-size: 13px;
        color: var(--wf-ink);
        cursor: pointer;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.15s;
        font-family: inherit;
      }
      .set-nav button:hover {
        background: var(--wf-hairline);
      }
      .set-nav button.active {
        background: var(--wf-ink);
        color: var(--wf-bg);
      }
      .set-nav button.adv-nav {
        margin-top: 18px;
        color: var(--wf-ink-faint);
        font-style: italic;
        font-size: 12px;
        border-top: 0.5px solid color-mix(in srgb, var(--wf-hairline) 60%, transparent);
        padding-top: 14px;
        border-radius: 0;
      }
      .set-nav button.adv-nav:hover {
        color: var(--wf-ink-soft);
        background: color-mix(in srgb, var(--wf-hairline) 60%, transparent);
      }
      .set-nav button.adv-nav.active {
        background: var(--wf-ink);
        color: var(--wf-bg);
        font-style: normal;
        border-radius: 10px;
        border-top: none;
      }
      
      .set-nav button > i.ti {
        font-size: 15px;
        color: currentColor;
      }

      /* body */
      .set-body { min-width: 0; }
      .set-body section {
        scroll-margin-top: 80px; /* breadcrumb height */
      }

      .set-card {
        background: var(--wf-bg-2);
        border-radius: 14px;
        border: 0.5px solid color-mix(in srgb, var(--wf-hairline) 60%, transparent);
        padding: 18px 22px;
        margin-bottom: 14px;
      }
      .set-card h3 {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .set-card .desc {
        font-size: 13px;
        color: var(--wf-ink-soft);
        line-height: 1.6;
        margin-bottom: 14px;
      }
      .hint {
        font-size: 12px;
        color: var(--wf-ink-faint);
        font-style: italic;
        margin: 8px 0 0;
      }
      .empty-hint {
        font-size: 13px;
        color: var(--wf-ink-faint);
        font-style: italic;
        margin: 0 0 12px;
      }

      /* category & vibe pills */
      .cats-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .cat-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        background: var(--wf-bg);
        border: 0.5px solid color-mix(in srgb, var(--wf-hairline) 60%, transparent);
        border-radius: 20px;
        font-size: 13px;
        color: var(--wf-ink);
      }
      .cat-pill .sw {
        width: 12px; height: 12px;
        border-radius: 50%;
      }
      .vibe-pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        background: var(--wf-bg);
        border: 0.5px solid color-mix(in srgb, var(--wf-hairline) 60%, transparent);
        border-radius: 18px;
        font-size: 12px;
        color: var(--wf-ink);
      }

      /* theme tiles */
      .theme-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 12px;
        margin-top: 8px;
      }
      .theme-tile {
        border-radius: 12px;
        border: 1.5px solid transparent;
        background: var(--wf-bg);
        cursor: pointer;
        transition: all 0.2s;
        padding: 12px;
        text-align: left;
        font-family: inherit;
      }
      .theme-tile:hover {
        border-color: var(--wf-ink-soft);
        transform: translateY(-2px);
      }
      .theme-tile.active {
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .theme-tile .swatches {
        display: flex;
        gap: 4px;
        margin-bottom: 8px;
      }
      .theme-tile .swatches span {
        width: 18px; height: 18px;
        border-radius: 4px;
      }
      .theme-tile .nm {
        font-size: 13px;
        font-weight: 500;
        color: var(--wf-ink);
      }
      .theme-tile .theme-desc {
        font-size: 11px;
        color: var(--wf-ink-soft);
        margin-top: 2px;
        line-height: 1.4;
      }

      /* collections */
      .col-list {
        list-style: none;
        margin: 0 0 12px;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .col-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--wf-bg);
        border: 0.5px solid color-mix(in srgb, var(--wf-hairline) 60%, transparent);
        border-radius: 10px;
        font-size: 13px;
      }

      .col-cover {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg, var(--wf-accent), var(--wf-gold));
        color: white;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .col-cover i.ti {
        font-size: 18px;
        color: white;
      }
      .col-cover:hover {
        transform: scale(1.04);
        box-shadow: 0 4px 12px color-mix(in srgb, var(--wf-ink) 12%, transparent);
      }
      
      .col-open {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--wf-ink-soft);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-weight: 500;
        transition: all 0.15s ease;
      }
        
      .col-open:hover {
        color: var(--wf-accent);
        background: color-mix(in srgb, var(--wf-accent) 8%, transparent);
      }

      .col-open i {
        font-size: 11px;
      }

      /* Tabler icon sizing inside Settings icon buttons */
      .icon-btn i.ti {
        font-size: 14px;
      }

      .col-name { flex: 1; color: var(--wf-ink); }
      .col-count { font-size: 11px; color: var(--wf-ink-faint); }
      .col-input {
        flex: 1;
        padding: 6px 10px;
        border-radius: 6px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        font: inherit;
        font-size: 13px;
        color: var(--wf-ink);
      }
      .col-input:focus {
        outline: none;
        border-color: var(--wf-accent);
        box-shadow: var(--wf-glow);
      }
      .icon-btn {
        background: transparent;
        border: none;
        color: var(--wf-ink-faint);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .icon-btn:hover {
        color: var(--wf-ink);
        background: var(--wf-hairline);
      }
      .icon-btn.danger:hover {
        color: var(--wf-accent);
        background: color-mix(in srgb, var(--wf-accent) 12%, transparent);
      }
      .create-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .create-row .col-input {
        flex: 1;
        padding: 10px 12px;
      }

      /* storage */
      .folder-info {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        background: var(--wf-bg);
        border-radius: 10px;
        border: 0.5px solid color-mix(in srgb, var(--wf-hairline) 60%, transparent);
        font-size: 13px;
        margin-bottom: 14px;
      }
      .folder-text { flex: 1; min-width: 0; }
      .folder-info .path {
        font-size: 11px;
        color: var(--wf-ink-soft);
        margin-top: 2px;
      }
      .btn.change {
        margin-left: auto;
        flex-shrink: 0;
        font-size: 12px;
        padding: 6px 12px;
      }
      .backup-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .import-label { cursor: pointer; }
      .file-input { display: none; }
      .backup-freq {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
      }
      .freq-label {
        font-size: 12px;
        color: var(--wf-ink-soft);
      }
      .freq-select {
        padding: 8px 10px;
        font-size: 12px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg);
        color: var(--wf-ink);
        font: inherit;
      }
      .import-feedback {
        font-size: 12px;
        color: var(--wf-ink-soft);
        margin: 12px 0 0;
        padding: 8px 12px;
        background: var(--wf-bg);
        border-radius: 6px;
      }
      .import-feedback.err {
        color: var(--wf-accent);
        background: color-mix(in srgb, var(--wf-accent) 10%, transparent);
      }
      .danger-zone {
        margin-top: 18px;
        padding: 14px;
        border: 0.5px solid color-mix(in srgb, var(--wf-accent) 40%, transparent);
        border-radius: 10px;
        background: color-mix(in srgb, var(--wf-accent) 5%, transparent);
      }
      .danger-zone h4 {
        margin: 0 0 6px;
        font-size: 13px;
        font-weight: 600;
        color: var(--wf-accent);
      }
      .danger-zone p {
        font-size: 12px;
        color: var(--wf-ink-soft);
        line-height: 1.5;
        margin: 0 0 10px;
      }

      /* about */
      .lead {
        font-family: var(--wf-font-display);
        font-size: 18px;
        color: var(--wf-ink);
        margin: 0 0 14px;
        line-height: 1.5;
        font-weight: 500;
        letter-spacing: -0.2px;
      }
      .prose {
        font-size: 13px;
        color: var(--wf-ink-soft);
        line-height: 1.7;
        margin: 0 0 12px;
      }
      .legal {
        font-size: 11px;
        color: var(--wf-ink-faint);
        font-style: italic;
        margin: 0;
        padding-top: 14px;
        border-top: 0.5px solid color-mix(in srgb, var(--wf-hairline) 50%, transparent);
      }
      .credit-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        padding: 8px 0;
        border-bottom: 0.5px solid color-mix(in srgb, var(--wf-hairline) 50%, transparent);
      }
      .credit-row:last-child { border-bottom: none; }
      .credit-label { color: var(--wf-ink-soft); }
      .credit-val { color: var(--wf-ink); text-align: right; }
      .credit-link {
        color: var(--wf-accent);
        text-decoration: none;
        font-size: 13px;
      }
      .credit-link:hover { text-decoration: underline; }

      /* buttons */
      .btn {
        padding: 10px 16px;
        border-radius: 8px;
        border: 0.5px solid var(--wf-hairline);
        background: var(--wf-bg-2);
        color: var(--wf-ink);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .btn.primary {
        background: var(--wf-ink);
        color: var(--wf-bg);
        border-color: var(--wf-ink);
      }
      .btn.primary:hover:not(:disabled) {
        background: var(--wf-accent);
        border-color: var(--wf-accent);
      }
      .btn.danger {
        color: var(--wf-accent);
        border-color: color-mix(in srgb, var(--wf-accent) 50%, transparent);
      }
      .btn.danger:hover {
        background: color-mix(in srgb, var(--wf-accent) 12%, transparent);
      }
      .link {
        background: transparent;
        border: none;
        font-size: 12px;
        color: var(--wf-ink-soft);
        cursor: pointer;
        padding: 4px 6px;
        font-weight: 500;
        font-family: inherit;
      }
      .link.primary { color: var(--wf-accent); }
      .link:hover { color: var(--wf-ink); }

      /* mobile stack */
      @media (max-width: 720px) {
        .set-grid {
          grid-template-columns: 1fr;
        }
        .set-nav {
          position: static;
          flex-direction: row;
          overflow-x: auto;
          padding-bottom: 4px;
          gap: 6px;
        }
        .set-nav button.adv-nav {
          margin-top: 0;
          border-top: none;
          padding-top: 10px;
        }
        .backup-freq {
          margin-left: 0;
          width: 100%;
        }
        .freq-select { flex: 1; }
      }
    `,
  ],
})
export class SettingsComponent implements AfterViewInit, OnDestroy {
  protected collections = inject(CollectionsStore);
  protected places = inject(PlacesStore);
  protected categories = inject(CategoriesStore);
  protected vibeTags = inject(VibeTagsStore);
  protected appState = inject(AppStateStore);
  protected storage = inject(STORAGE_ADAPTER);
  private router = inject(Router);

  @ViewChild('scrollHost', { static: true })
  private scrollHost!: ElementRef<HTMLElement>;

  // Each section element, queried after view init for scroll detection
  private sectionElements: HTMLElement[] = [];
  private intersectionObserver?: IntersectionObserver;

  // Tracks which section is currently in view (for sidebar highlight)
  protected activeSection = signal<SettingsSection>('categories');

  // Collections inline edit state
  protected newCollectionName = signal('');
  protected editingCollectionId = signal<string | null>(null);
  protected editingCollectionName = signal('');

  // Data feedback
  protected importResult = signal<string | null>(null);

  /**
   * When non-null, the icon picker is open editing this collection's icon.
   * Stored as the collection id rather than a bool so we know which one to update.
  */
  protected iconPickerForCollectionId = signal<string | null>(null);

  /** Exposed to template so the fallback when coverIcon is missing matches the constant. */
  protected defaultCoverIcon = DEFAULT_COVER_ICON;

  protected navItems: { id: SettingsSection; label: string; icon: string }[] = [
    { id: 'categories', label: 'Categories & vibes', icon: 'tags' },
    { id: 'collections', label: 'Collections',         icon: 'folder' },
    { id: 'theme',       label: 'Theme',               icon: 'palette' },
    { id: 'storage',     label: 'Storage & backup',    icon: 'database-export' },
    { id: 'about',       label: 'About',               icon: 'info-circle' },
    { id: 'advanced',    label: 'Advanced',            icon: 'tool' },
  ];

  protected themes: ThemeTile[] = [
    { id: 'paper',    name: 'Paper',             swatches: ['#FAF6EF', '#1A1A2E', '#FF6B5B'], desc: 'warm cream, ink, coral. Default.' },
    { id: 'neon',     name: 'Neon Drift',        swatches: ['#0E0F1A', '#FF3D9A', '#7AFFD7'], desc: 'dark, magenta + mint. Glow on hover.' },
    { id: 'kyoto',    name: 'Kyoto Night',       swatches: ['#0F1729', '#E8A547', '#F4D58D'], desc: 'deep navy + warm gold. Lantern glow.' },
    { id: 'mono',     name: 'Mono Press',        swatches: ['#FFFFFF', '#000000', '#D72638'], desc: 'b/w, single red, sharp corners.' },
    { id: 'midnight', name: 'Midnight Library',  swatches: ['#1B0F1F', '#D4A74C', '#E8C57A'], desc: 'deep plum + brass + cream. Cozy reading nook.' },
    { id: 'subway',   name: 'Tokyo Subway',      swatches: ['#FAFAFA', '#1C1C1C', '#0066CC'], desc: 'white + electric blue. Clean transit signage.' },
    { id: 'forest',   name: 'Forest Floor',      swatches: ['#EFEAD8', '#1F2D1A', '#3F6B47'], desc: 'deep green + ochre. Forest canopy after rain.' },
  ];

  protected placeCount = computed(() => this.places.entities().length);

  protected lastBackupLabel = computed(() => {
    const last = this.appState.lastBackupAt();
    if (!last) return 'never';
    const diff = Date.now() - new Date(last).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
    return `${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  });

  ngAfterViewInit(): void {
    // Find all section elements
    this.sectionElements = Array.from(
      this.scrollHost.nativeElement.querySelectorAll<HTMLElement>('[data-section]')
    );

    // Watch which section is most visible; update activeSection
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        // Pick the most-visible entry by intersection ratio
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible.length > 0) {
          const id = (visible[0].target as HTMLElement).dataset['section'];
          if (id) this.activeSection.set(id as SettingsSection);
        }
      },
      {
        // Top 1/3 of viewport biased — a section becomes "active" once its top
        // crosses into the upper portion
        rootMargin: '-80px 0px -50% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    this.sectionElements.forEach((el) => this.intersectionObserver!.observe(el));
  }

  ngOnDestroy(): void {
    this.intersectionObserver?.disconnect();
  }

  protected scrollToSection(id: SettingsSection): void {
    const el = this.sectionElements.find(
      (el) => el.dataset['section'] === id
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSection.set(id);
  }

  protected onBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }

  // ----- Theme -----

  protected setTheme(themeId: ThemeName): void {
    this.appState.setTheme(themeId);
  }

  // ----- Collections -----

  protected placesInCollection(collectionId: string): number {
    return this.places.entities().filter((p) =>
      p.collectionIds.includes(collectionId)
    ).length;
  }

  protected async createCollection(): Promise<void> {
    const name = this.newCollectionName().trim();
    if (!name) return;
    await this.collections.create(name);
    this.newCollectionName.set('');
  }

  protected startEditCollection(id: string, name: string): void {
    this.editingCollectionId.set(id);
    this.editingCollectionName.set(name);
  }

  protected async saveCollectionEdit(): Promise<void> {
    const id = this.editingCollectionId();
    const name = this.editingCollectionName().trim();
    if (!id || !name) return;
    await this.collections.updatePartial(id, { name });
    this.editingCollectionId.set(null);
  }

  protected cancelCollectionEdit(): void {
    this.editingCollectionId.set(null);
    this.editingCollectionName.set('');
  }

  protected async deleteCollection(id: string): Promise<void> {
    if (!confirm("Delete this collection? Places in it won't be deleted.")) return;
    await this.collections.remove(id);
  }

  // ----- Storage / Backup -----

  protected setAutoBackupFreq(value: AppState['autoBackupFrequency']): void {
    this.appState.patch({ autoBackupFrequency: value });
  }

  protected async exportData(): Promise<void> {
    try {
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
      // Mark as backed up — sets lastBackupAt = now AND clears
      // lastChangeAt so the topbar saved/unsaved indicator flips back
      // to "saved" immediately.
      await this.appState.recordBackup();
      this.importResult.set('Backup exported.');
    } catch (err) {
      this.importResult.set(`Error exporting: ${err}`);
    }
  }

  protected async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.importResult.set(null);

    try {
      const text = await file.text();
      const result = await this.storage.importAll(text, 'merge');
      await this.places.load();
      await this.collections.load();
      this.importResult.set(
        `Imported ${result.imported} places. ${result.skipped} skipped.`
      );
    } catch (err) {
      this.importResult.set(`Error importing: ${String(err)}`);
    }

    input.value = '';
  }

  protected confirmClearAll(): void {
    const confirmed = confirm(
      'This will delete all your places, visits, and collections. This cannot be undone. Are you sure?'
    );
    if (!confirmed) return;
    this.clearAll();
  }

  private async clearAll(): Promise<void> {
    try {
      await this.storage.clear();
      await this.places.load();
      await this.collections.load();
      this.importResult.set('All data cleared.');
    } catch (err) {
      this.importResult.set(`Error clearing data: ${err}`);
    }
  }

  /** Returns the CSS gradient string for a collection's cover. */
  protected coverGradientFor(c: { coverGradient?: string }): string {
    return gradientCss(c.coverGradient as any);
  }

  protected openIconPickerFor(collectionId: string): void {
    this.iconPickerForCollectionId.set(collectionId);
  }

  protected closeIconPicker(): void {
    this.iconPickerForCollectionId.set(null);
  }

  protected async onIconPicked(collectionId: string, iconName: string): Promise<void> {
    await this.collections.updatePartial(collectionId, { coverIcon: iconName });
    this.iconPickerForCollectionId.set(null);
  }

}