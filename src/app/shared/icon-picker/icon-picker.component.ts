import {
  Component,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Each entry from @tabler/icons' manifest. The package's `icons` export
 * gives us an object keyed by icon name; we transform it into a flat array
 * with the searchable fields we care about.
 */
interface IconEntry {
  /** Tabler name without the 'ti-' prefix, e.g. 'folder', 'bike'. */
  name: string;
  /** Lowercase search target: name + tags + category, space-joined. */
  search: string;
}

@Component({
  selector: 'wf-icon-picker',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" (click)="onCancel()"></div>
    <div class="picker" role="dialog" aria-modal="true" aria-label="Pick an icon">
      <header class="head">
        <h3>Pick an icon</h3>
        <button class="close" (click)="onCancel()" aria-label="Close">
          <i class="ti ti-x"></i>
        </button>
      </header>

      <div class="search-wrap">
        <i class="ti ti-search search-icon"></i>
        <input
          #searchInput
          type="text"
          class="search"
          placeholder="Search icons (food, sport, hobby…)"
          [ngModel]="query()"
          (ngModelChange)="onQueryChange($event)"
        />
        @if (query()) {
          <button class="clear-search" (click)="clearQuery()" aria-label="Clear search">
            <i class="ti ti-x"></i>
          </button>
        }
      </div>

      @if (!loaded()) {
        <div class="state">Loading icon library…</div>
      } @else if (visibleIcons().length === 0) {
        <div class="state">
          No icons match "<strong>{{ query() }}</strong>". Try a simpler word.
        </div>
      } @else {
        <div class="result-meta">
          {{ visibleIcons().length.toLocaleString() }} icons
        </div>
        <div class="grid" #gridEl (scroll)="onScroll($event)">
          <div class="virt-spacer" [style.height.px]="virtualHeight()"></div>
          <div class="virt-rows" [style.transform]="virtualOffsetTransform()">
            @for (icon of visibleSlice(); track icon.name) {
              <button
                class="icon-cell"
                [class.selected]="icon.name === selected()"
                (click)="onPick(icon.name)"
                [attr.aria-label]="icon.name"
                [title]="icon.name"
              >
                <i class="ti" [class]="'ti-' + icon.name"></i>
              </button>
            }
          </div>
        </div>
      }

      <footer class="foot">
        <button class="btn" (click)="onCancel()">Cancel</button>
        <button
          class="btn primary"
          [disabled]="!selected()"
          (click)="onConfirm()"
        >
          Use this icon
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--wf-ink) 35%, transparent);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .picker {
      position: relative;
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: 16px;
      width: 560px;
      max-width: calc(100vw - 32px);
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 24px 48px color-mix(in srgb, var(--wf-ink) 30%, transparent);
      overflow: hidden;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 12px;
    }
    .head h3 {
      margin: 0;
      font-family: var(--wf-font-display);
      font-size: 18px;
      font-weight: 500;
      color: var(--wf-ink);
    }
    .close {
      background: transparent;
      border: none;
      color: var(--wf-ink-soft);
      cursor: pointer;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }
    .close:hover {
      background: var(--wf-hairline);
      color: var(--wf-ink);
    }
    .search-wrap {
      position: relative;
      padding: 0 20px;
    }
    .search-icon {
      position: absolute;
      left: 32px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--wf-ink-faint);
      font-size: 16px;
      pointer-events: none;
    }
    .search {
      width: 100%;
      padding: 10px 36px 10px 36px;
      border-radius: 10px;
      border: 0.5px solid var(--wf-hairline);
      background: var(--wf-bg-2);
      font: inherit;
      font-size: 13px;
      color: var(--wf-ink);
    }
    .search:focus {
      outline: none;
      border-color: var(--wf-accent);
      box-shadow: var(--wf-glow);
    }
    .clear-search {
      position: absolute;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      color: var(--wf-ink-faint);
      cursor: pointer;
      padding: 4px;
      font-size: 14px;
    }
    .clear-search:hover { color: var(--wf-ink); }

    .result-meta {
      font-size: 11px;
      color: var(--wf-ink-faint);
      padding: 8px 20px 4px;
    }
    .state {
      padding: 32px 20px;
      text-align: center;
      color: var(--wf-ink-soft);
      font-size: 13px;
    }
    .state strong {
      color: var(--wf-ink);
      font-weight: 500;
    }

    .grid {
      flex: 1;
      overflow-y: auto;
      position: relative;
      padding: 4px 20px 20px;
      min-height: 240px;
    }
    .virt-spacer {
      width: 1px;
      pointer-events: none;
    }
    .virt-rows {
      position: absolute;
      top: 0;
      left: 20px;
      right: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
      gap: 4px;
    }
    .icon-cell {
      width: 100%;
      aspect-ratio: 1;
      background: transparent;
      border: 0.5px solid transparent;
      border-radius: 8px;
      color: var(--wf-ink);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.12s ease;
      padding: 0;
    }
    .icon-cell i {
      font-size: 20px;
    }
    .icon-cell:hover {
      background: var(--wf-bg-2);
      border-color: var(--wf-hairline);
    }
    .icon-cell.selected {
      background: color-mix(in srgb, var(--wf-accent) 18%, transparent);
      border-color: var(--wf-accent);
      color: var(--wf-accent);
    }

    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 20px 16px;
      border-top: 0.5px solid var(--wf-hairline);
    }
    .btn {
      padding: 9px 16px;
      font-size: 13px;
      font-weight: 500;
      border-radius: 10px;
      border: 0.5px solid var(--wf-hairline);
      background: var(--wf-bg-2);
      color: var(--wf-ink);
      cursor: pointer;
      font-family: inherit;
    }
    .btn:disabled {
      opacity: 0.4;
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
  `],
})
export class IconPickerComponent implements AfterViewInit {
  @ViewChild('gridEl', { static: false }) gridEl?: ElementRef<HTMLDivElement>;

  /** All icons in the Tabler library, loaded once on init from npm package. */
  protected icons = signal<IconEntry[]>([]);
  protected loaded = signal(false);

  /** Current search query (debounced by Angular signals). */
  protected query = signal('');

  /** The icon name currently highlighted/selected by the user. */
  protected selected = signal<string | null>(null);

  /** Virtual scroll state. */
  private rowHeight = 48; // 44 cell + 4 gap
  private columnsPerRow = 11; // measured at ~520px content width / 44px cell + gap
  protected scrollTop = signal(0);
  private overscan = 4; // extra rows above/below viewport

  readonly picked = output<string>();
  readonly cancelled = output<void>();

  constructor() {
    this.loadIconLibrary();
  }

  ngAfterViewInit(): void {
    // Recalculate columns based on actual rendered width
    const el = this.gridEl?.nativeElement;
    if (el) {
      const inner = el.querySelector('.virt-rows') as HTMLElement | null;
      if (inner) {
        // Estimate columns from current style
        const width = el.clientWidth - 40; // minus host padding
        this.columnsPerRow = Math.max(1, Math.floor(width / 48));
      }
    }
  }

  /**
   * Loads the Tabler icon manifest from the npm package. Uses dynamic import
   * so the ~200kb manifest only ships when the user opens the picker.
   */
  	private async loadIconLibrary(): Promise<void> {
      try {
        // @iconify-json/tabler ships the full Tabler icon set as a JSON manifest.
        // Dynamic import = the ~1MB manifest only ships when the user opens the picker.
        const mod: any = await import('@iconify-json/tabler/icons.json');
        const data = mod.default ?? mod;
        const iconsObj = data.icons ?? {};

        const entries: IconEntry[] = [];
        for (const name of Object.keys(iconsObj)) {
          // Each icon entry in iconify format has body + dimensions. Tags aren't
          // stored per-icon in the JSON, so search is by name only — fine since
          // Tabler's naming convention is descriptive (bike-electric, food-fork, etc).
          entries.push({
            name,
            search: name.toLowerCase().replace(/-/g, ' '),
          });
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        this.icons.set(entries);
      } catch {
        // Fallback if the package isn't installed yet — picker still usable.
        this.icons.set([
          { name: 'folder', search: 'folder' },
          { name: 'home', search: 'home house' },
          { name: 'star', search: 'star favorite' },
          { name: 'heart', search: 'heart like love' },
          { name: 'map-pin', search: 'pin location map' },
        ]);
      }
      this.loaded.set(true);
    }

  /** Icons that match the search query. */
  protected visibleIcons = computed<IconEntry[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.icons();
    if (!q) return all;
    return all.filter((i) => i.search.includes(q));
  });

  /** Total virtual scroll height for the filtered list. */
  protected virtualHeight = computed<number>(() => {
    const rows = Math.ceil(this.visibleIcons().length / this.columnsPerRow);
    return rows * this.rowHeight;
  });

  /** CSS transform that positions the rendered rows at the right scroll offset. */
  protected virtualOffsetTransform = computed<string>(() => {
    const top = this.scrollTop();
    const startRow = Math.max(0, Math.floor(top / this.rowHeight) - this.overscan);
    return `translateY(${startRow * this.rowHeight}px)`;
  });

  /** The slice of icons currently rendered (only visible rows + overscan). */
  protected visibleSlice = computed<IconEntry[]>(() => {
    const all = this.visibleIcons();
    const top = this.scrollTop();
    const gridEl = this.gridEl?.nativeElement;
    const viewHeight = gridEl?.clientHeight ?? 400;

    const startRow = Math.max(0, Math.floor(top / this.rowHeight) - this.overscan);
    const endRow =
      Math.ceil((top + viewHeight) / this.rowHeight) + this.overscan;

    const startIdx = startRow * this.columnsPerRow;
    const endIdx = Math.min(all.length, endRow * this.columnsPerRow);

    return all.slice(startIdx, endIdx);
  });

  protected onScroll(event: Event): void {
    const target = event.target as HTMLDivElement;
    this.scrollTop.set(target.scrollTop);
  }

  protected onQueryChange(value: string): void {
    this.query.set(value);
    this.scrollTop.set(0);
    // Don't clear selection — user might be refining their search around a choice
  }

  protected clearQuery(): void {
    this.query.set('');
    this.scrollTop.set(0);
  }

  protected onPick(name: string): void {
    this.selected.set(name);
  }

  protected onConfirm(): void {
    const name = this.selected();
    if (name) this.picked.emit(name);
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}

