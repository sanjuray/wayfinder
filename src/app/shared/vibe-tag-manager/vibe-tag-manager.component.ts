import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VibeTagsStore } from '../../core/stores/vibe-tags.store';
import { IdService } from '../../core/services/id.service';
import type { VibeTag } from '../../core/models';

/**
 * Manage vibe tags. Simpler than categories — no icon, no color, just
 * a name. Same hideable-not-deletable model for defaults.
 *
 * Tags render as inline pills with edit-on-click for active rows;
 * hidden tags collapsed in a separate section.
 */
@Component({
  selector: 'wf-vibe-tag-manager',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="manager">
      <header class="mgr-head">
        <div class="mgr-title">
          <h3>Vibe tags</h3>
          <p class="desc">
            Lightweight descriptors users multi-select on a place. Defaults
            cover common moods; add your own for the things you care
            about. Hidden tags stop appearing in the picker until restored.
          </p>
        </div>
        @if (!adding()) {
          <button class="btn primary" (click)="startAdd()">
            <i class="ti ti-plus"></i>
            New vibe
          </button>
        }
      </header>

      @if (adding()) {
        <div class="row editing">
          <div class="name-wrap">
            <input
              class="name-input"
              [class.error]="addError() !== null"
              [ngModel]="draftName()"
              (ngModelChange)="onNameChange($event)"
              (keydown.enter)="commitAdd()"
              (keydown.escape)="cancelAdd()"
              placeholder="Vibe name (e.g. quiet, romantic, kid-friendly)"
              autofocus
            />
            @if (addError(); as err) {
              <p class="row-error">{{ err }}</p>
            }
          </div>
          <div class="row-actions">
            <button class="btn ghost" (click)="cancelAdd()">Cancel</button>
            <button
              class="btn primary"
              [disabled]="!draftName().trim() || addError() !== null"
              (click)="commitAdd()"
            >
              Add
            </button>
          </div>
        </div>
      }

      <ul class="list">
        @for (v of visibleTags(); track v.id) {
          <li class="row" [class.editing]="editingId() === v.id">
            @if (editingId() === v.id) {
              <div class="name-wrap">
                <input
                  class="name-input"
                  [class.error]="editError() !== null"
                  [ngModel]="draftName()"
                  (ngModelChange)="onNameChange($event)"
                  (keydown.enter)="commitEdit()"
                  (keydown.escape)="cancelEdit()"
                  autofocus
                />
                @if (editError(); as err) {
                  <p class="row-error">{{ err }}</p>
                }
              </div>
              <div class="row-actions">
                <button class="btn ghost" (click)="cancelEdit()">Cancel</button>
                <button
                  class="btn primary"
                  [disabled]="!draftName().trim() || editError() !== null"
                  (click)="commitEdit()"
                >
                  Save
                </button>
              </div>
            } @else {
              <span class="tag-display" (click)="startEdit(v)">
                <span class="nm">{{ v.name }}</span>
                @if (v.isDefault) {
                  <span class="default-badge">default</span>
                }
              </span>
              <div class="row-actions">
                <button
                  class="icon-btn"
                  (click)="toggleHidden(v)"
                  [title]="'Hide ' + v.name"
                  aria-label="Hide vibe"
                >
                  <i class="ti ti-eye-off"></i>
                </button>
                @if (!v.isDefault) {
                  <button
                    class="icon-btn danger"
                    (click)="deleteTag(v)"
                    [title]="'Delete ' + v.name"
                    aria-label="Delete vibe"
                  >
                    <i class="ti ti-trash"></i>
                  </button>
                }
              </div>
            }
          </li>
        }
      </ul>

      @if (hiddenTags().length > 0) {
        <div class="hidden-section">
          <button
            class="hidden-toggle"
            (click)="showHidden.update(v => !v)"
          >
            <i class="ti" [class]="showHidden() ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
            {{ hiddenTags().length }} hidden
          </button>
          @if (showHidden()) {
            <ul class="list">
              @for (v of hiddenTags(); track v.id) {
                <li class="row hidden-row">
                  <span class="tag-display">
                    <span class="nm">{{ v.name }}</span>
                  </span>
                  <div class="row-actions">
                    <button
                      class="icon-btn"
                      (click)="toggleHidden(v)"
                      [title]="'Show ' + v.name + ' again'"
                    >
                      <i class="ti ti-eye"></i>
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .manager { display: flex; flex-direction: column; gap: 12px; }
    .mgr-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .mgr-title h3 {
      margin: 0 0 4px;
      font-family: var(--wf-font-display);
      font-size: 17px;
      font-weight: 500;
      color: var(--wf-ink);
    }
    .mgr-title .desc {
      margin: 0;
      font-size: 13px;
      color: var(--wf-ink-soft);
      max-width: 540px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 7px 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      border-radius: 8px;
      border: 0.5px solid var(--wf-hairline);
      background: var(--wf-bg-2);
      color: var(--wf-ink);
      cursor: pointer;
      white-space: nowrap;
    }
    .btn:hover { background: var(--wf-bg); border-color: var(--wf-ink-faint); }
    .btn.primary {
      background: var(--wf-accent);
      border-color: var(--wf-accent);
      color: var(--wf-bg);
    }
    .btn.primary:hover { filter: brightness(1.05); }
    .btn.primary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      filter: none;
    }
    .btn.ghost {
      background: transparent;
      color: var(--wf-ink-soft);
    }
    .btn i { font-size: 13px; }

    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: 8px;
      transition: background 0.12s, border-color 0.12s;
    }
    .row:not(.editing):hover {
      background: var(--wf-bg-2);
    }
    .row.editing {
      background: color-mix(in srgb, var(--wf-accent) 4%, var(--wf-bg));
      border-color: color-mix(in srgb, var(--wf-accent) 30%, transparent);
    }
    .tag-display {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      min-width: 0;
    }
    .nm {
      font-size: 14px;
      color: var(--wf-ink);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .default-badge {
      font-size: 10px;
      color: var(--wf-ink-faint);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .name-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .name-input {
      width: 100%;
      padding: 7px 10px;
      font: inherit;
      font-size: 14px;
      color: var(--wf-ink);
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: 6px;
    }
    .name-input:focus {
      outline: none;
      border-color: var(--wf-accent);
      box-shadow: var(--wf-glow);
    }
    .name-input.error {
      border-color: var(--wf-accent);
      background: color-mix(in srgb, var(--wf-accent) 4%, var(--wf-bg));
    }
    .row-error {
      margin: 0;
      font-size: 11px;
      color: var(--wf-accent);
    }
    .row-actions {
      display: inline-flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .icon-btn {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: 0.5px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      color: var(--wf-ink-soft);
    }
    .icon-btn:hover {
      background: var(--wf-bg-2);
      border-color: var(--wf-hairline);
      color: var(--wf-ink);
    }
    .icon-btn.danger:hover {
      color: var(--wf-accent);
      background: color-mix(in srgb, var(--wf-accent) 8%, transparent);
      border-color: color-mix(in srgb, var(--wf-accent) 40%, transparent);
    }
    .icon-btn i { font-size: 14px; }

    .hidden-section {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 0.5px dashed var(--wf-hairline);
    }
    .hidden-toggle {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 8px;
      font: inherit;
      font-size: 12px;
      color: var(--wf-ink-soft);
      background: transparent;
      border: none;
      cursor: pointer;
      border-radius: 4px;
    }
    .hidden-toggle:hover { color: var(--wf-ink); }
    .hidden-toggle i { font-size: 12px; }
    .hidden-row {
      opacity: 0.6;
    }
  `],
})
export class VibeTagManagerComponent {
  protected vibeTags = inject(VibeTagsStore);
  private idService = inject(IdService);

  protected adding = signal(false);
  protected editingId = signal<string | null>(null);
  protected showHidden = signal(false);

  protected draftName = signal('');

  protected addError = signal<string | null>(null);
  protected editError = signal<string | null>(null);

  protected visibleTags = computed(() =>
    [...this.vibeTags.entities()]
      .filter((v) => !v.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  protected hiddenTags = computed(() =>
    [...this.vibeTags.entities()]
      .filter((v) => v.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  // ---- Add flow ----

  protected startAdd(): void {
    this.editingId.set(null);
    this.adding.set(true);
    this.draftName.set('');
    this.addError.set(null);
  }

  protected cancelAdd(): void {
    this.adding.set(false);
    this.addError.set(null);
  }

  protected async commitAdd(): Promise<void> {
    const name = this.draftName().trim();
    if (!name) return;
    if (!this.vibeTags.nameAvailable(name)) {
      this.addError.set('A vibe with this name already exists.');
      return;
    }
    await this.vibeTags.add({
      id: this.idService.newId(),
      name,
      isDefault: false,
      hidden: false,
    });
    this.adding.set(false);
    this.addError.set(null);
  }

  // ---- Edit flow ----

  protected startEdit(v: VibeTag): void {
    this.adding.set(false);
    this.editingId.set(v.id);
    this.draftName.set(v.name);
    this.editError.set(null);
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set(null);
  }

  protected async commitEdit(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const name = this.draftName().trim();
    if (!name) return;
    if (!this.vibeTags.nameAvailable(name, id)) {
      this.editError.set('A vibe with this name already exists.');
      return;
    }
    const current = this.vibeTags.entities().find((v) => v.id === id);
    if (!current) return;
    await this.vibeTags.update({ ...current, name });
    this.editingId.set(null);
    this.editError.set(null);
  }

  protected onNameChange(name: string): void {
    this.draftName.set(name);
    const trimmed = name.trim();
    const id = this.editingId();
    if (this.adding()) {
      if (!trimmed) {
        this.addError.set(null);
        return;
      }
      this.addError.set(
        this.vibeTags.nameAvailable(trimmed)
          ? null
          : 'A vibe with this name already exists.'
      );
    } else if (id) {
      if (!trimmed) {
        this.editError.set(null);
        return;
      }
      this.editError.set(
        this.vibeTags.nameAvailable(trimmed, id)
          ? null
          : 'A vibe with this name already exists.'
      );
    }
  }

  protected async toggleHidden(v: VibeTag): Promise<void> {
    await this.vibeTags.update({ ...v, hidden: !v.hidden });
  }

  protected async deleteTag(v: VibeTag): Promise<void> {
    if (v.isDefault) return;
    await this.vibeTags.remove(v.id);
  }
}