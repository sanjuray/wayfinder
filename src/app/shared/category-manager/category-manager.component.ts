import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoriesStore } from '../../core/stores/categories.store';
import { IdService } from '../../core/services/id.service';
import { IconPickerComponent } from '../icon-picker/icon-picker.component';
import type { Category } from '../../core/models';

/**
 * Manage categories — list + edit + add + delete (custom only) + hide (default only).
 *
 * Design choices baked into this component:
 *   - **Default categories are hideable, not deletable.** They have
 *     `isDefault: true`; the row shows a "hide/show" toggle instead of
 *     a delete button. Custom categories get the delete button.
 *   - **Inline editing on row click.** Tapping a row swaps the display
 *     into edit mode: name input + color swatch (palette) + icon picker
 *     trigger. Save commits; Cancel reverts.
 *   - **Hidden categories grouped at the bottom** with reduced opacity.
 *     Click the eye icon to restore visibility.
 *   - **Name uniqueness enforced** via the store's nameAvailable() helper
 *     before commit. Live error message shows under the input.
 *
 * Out of scope for v1:
 *   - Drag-to-reorder. sortOrder field exists on the model but isn't
 *     exposed to users yet — categories are sorted alphabetically.
 *   - Bulk edit/delete.
 *   - Importing categories from the place form (e.g. "+ new category"
 *     inline when adding a place). Possible later phase.
 */
@Component({
  selector: 'wf-category-manager',
  standalone: true,
  imports: [FormsModule, IconPickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="manager">
      <header class="mgr-head">
        <div class="mgr-title">
          <h3>Categories</h3>
          <p class="desc">
            Wayfinder ships with sensible defaults. Add your own, hide
            the ones you don't use, or edit any of them. Deleted custom
            categories can't be recovered.
          </p>
        </div>
        @if (!adding()) {
          <button class="btn primary" (click)="startAdd()">
            <i class="ti ti-plus"></i>
            New category
          </button>
        }
      </header>

      @if (adding()) {
        <div class="row editing">
          <button
            type="button"
            class="icon-trigger"
            [style.color]="draftColor()"
            (click)="openIconPicker()"
            title="Pick an icon"
          >
            <i class="ti" [class]="'ti-' + draftIcon()"></i>
          </button>
          <input
            type="color"
            class="color-input"
            [value]="draftColor()"
            (input)="draftColor.set($any($event.target).value)"
            title="Pick a color"
          />
          <div class="name-wrap">
            <input
              class="name-input"
              [class.error]="addError() !== null"
              [ngModel]="draftName()"
              (ngModelChange)="onNameChange($event)"
              (keydown.enter)="commitAdd()"
              (keydown.escape)="cancelAdd()"
              placeholder="Category name"
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
        @for (c of visibleCategories(); track c.id) {
          <li
            class="row"
            [class.editing]="editingId() === c.id"
          >
            @if (editingId() === c.id) {
              <button
                type="button"
                class="icon-trigger"
                [style.color]="draftColor()"
                (click)="openIconPicker()"
                title="Pick an icon"
              >
                <i class="ti" [class]="'ti-' + draftIcon()"></i>
              </button>
              <input
                type="color"
                class="color-input"
                [value]="draftColor()"
                (input)="draftColor.set($any($event.target).value)"
                title="Pick a color"
              />
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
              <span class="cat-display" (click)="startEdit(c)">
                <span class="sw" [style.color]="c.color">
                  <i class="ti" [class]="'ti-' + c.icon"></i>
                </span>
                <span class="nm">{{ c.name }}</span>
                @if (c.isDefault) {
                  <span class="default-badge">default</span>
                }
              </span>
              <div class="row-actions">
                <button
                  class="icon-btn"
                  (click)="toggleHidden(c)"
                  [title]="'Hide ' + c.name + ' from pickers'"
                  aria-label="Hide category"
                >
                  <i class="ti ti-eye-off"></i>
                </button>
                @if (!c.isDefault) {
                  <button
                    class="icon-btn danger"
                    (click)="deleteCategory(c)"
                    [title]="'Delete ' + c.name"
                    aria-label="Delete category"
                  >
                    <i class="ti ti-trash"></i>
                  </button>
                }
              </div>
            }
          </li>
        }
      </ul>

      @if (hiddenCategories().length > 0) {
        <div class="hidden-section">
          <button
            class="hidden-toggle"
            (click)="showHidden.update(v => !v)"
          >
            <i class="ti" [class]="showHidden() ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
            {{ hiddenCategories().length }} hidden
          </button>
          @if (showHidden()) {
            <ul class="list">
              @for (c of hiddenCategories(); track c.id) {
                <li class="row hidden-row">
                  <span class="cat-display">
                    <span class="sw" [style.color]="c.color">
                      <i class="ti" [class]="'ti-' + c.icon"></i>
                    </span>
                    <span class="nm">{{ c.name }}</span>
                  </span>
                  <div class="row-actions">
                    <button
                      class="icon-btn"
                      (click)="toggleHidden(c)"
                      [title]="'Show ' + c.name + ' again'"
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

    @if (showIconPicker()) {
      <wf-icon-picker
        (picked)="onIconPicked($event)"
        (cancelled)="closeIconPicker()"
      />
    }
  `,
  styles: [`
    :host { display: block; }
    .manager {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
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
    .cat-display {
      flex: 1;
      display: inline-flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      min-width: 0;
    }
    .sw {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sw i { font-size: 18px; }
    .nm {
      flex: 1;
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
    .icon-trigger {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--wf-bg-2);
      border: 0.5px solid var(--wf-hairline);
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
    }
    .icon-trigger:hover { border-color: var(--wf-ink-faint); }
    .icon-trigger i { font-size: 16px; }
    .color-input {
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0.5px solid var(--wf-hairline);
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
      background: transparent;
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
export class CategoryManagerComponent {
  protected categories = inject(CategoriesStore);
  private idService = inject(IdService);

  protected adding = signal(false);
  protected editingId = signal<string | null>(null);
  protected showHidden = signal(false);
  protected showIconPicker = signal(false);

  protected draftName = signal('');
  protected draftIcon = signal('circle');
  protected draftColor = signal('#FF6B5B');

  protected addError = signal<string | null>(null);
  protected editError = signal<string | null>(null);

  protected visibleCategories = computed(() =>
    [...this.categories.entities()]
      .filter((c) => !c.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  protected hiddenCategories = computed(() =>
    [...this.categories.entities()]
      .filter((c) => c.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  // ---- Add flow ----

  protected startAdd(): void {
    this.editingId.set(null);
    this.adding.set(true);
    this.draftName.set('');
    this.draftIcon.set('map-pin');
    this.draftColor.set('#FF6B5B');
    this.addError.set(null);
  }

  protected cancelAdd(): void {
    this.adding.set(false);
    this.addError.set(null);
  }

  protected async commitAdd(): Promise<void> {
    const name = this.draftName().trim();
    if (!name) return;
    if (!this.categories.nameAvailable(name)) {
      this.addError.set('A category with this name already exists.');
      return;
    }
    const newCat = {
      id: this.idService.newId(),
      name,
      icon: this.draftIcon(),
      color: this.draftColor(),
      isDefault: false,
      hidden: false,
      sortOrder: 0,
    };
    await this.categories.add(newCat);
    this.adding.set(false);
    this.addError.set(null);
  }

  // ---- Edit flow ----

  protected startEdit(c: Category): void {
    this.adding.set(false);
    this.editingId.set(c.id);
    this.draftName.set(c.name);
    this.draftIcon.set(c.icon);
    this.draftColor.set(c.color);
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
    if (!this.categories.nameAvailable(name, id)) {
      this.editError.set('A category with this name already exists.');
      return;
    }
    const current = this.categories.entities().find((c) => c.id === id);
    if (!current) return;
    await this.categories.update({
      ...current,
      name,
      icon: this.draftIcon(),
      color: this.draftColor(),
    });
    this.editingId.set(null);
    this.editError.set(null);
  }

  // ---- Name change handler — shared between add + edit ----

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
        this.categories.nameAvailable(trimmed)
          ? null
          : 'A category with this name already exists.'
      );
    } else if (id) {
      if (!trimmed) {
        this.editError.set(null);
        return;
      }
      this.editError.set(
        this.categories.nameAvailable(trimmed, id)
          ? null
          : 'A category with this name already exists.'
      );
    }
  }

  // ---- Hide/show ----

  protected async toggleHidden(c: Category): Promise<void> {
    await this.categories.update({ ...c, hidden: !c.hidden });
  }

  // ---- Delete (custom only) ----

  protected async deleteCategory(c: Category): Promise<void> {
    if (c.isDefault) return;
    // No confirm — settings is already a deliberate space; the row's
    // explicit delete button isn't a one-click trap like map gestures.
    // If users delete the wrong one, "I'll add it back" is two clicks.
    await this.categories.remove(c.id);
  }

  // ---- Icon picker (modal) ----

  protected openIconPicker(): void {
    this.showIconPicker.set(true);
  }

  protected closeIconPicker(): void {
    this.showIconPicker.set(false);
  }

  protected onIconPicked(icon: string): void {
    this.draftIcon.set(icon);
    this.showIconPicker.set(false);
  }
}