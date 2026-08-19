import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CategoriesStore } from '../../core/stores/categories.store';
import { VibeTagsStore } from '../../core/stores/vibe-tags.store';
import { preferredMapsQuery, buildPlaceMapsUrl } from '../../core/utils/place-maps-query';
import type { Place } from '../../core/models';
 
/**
 * One place in a Scout result set. Compact row: category dot, name, meta line,
 * and a Google Maps link built from the place's preferred (or smart-default)
 * query. Trip results get a leading order number via the `index` input
 * (1-based; 0 or undefined hides it).
 *
 * The whole row selects the place (fly + open detail); the maps link is a
 * separate action that opens Google Maps in a new tab and does NOT trigger the
 * row's select (stopPropagation).
 */
@Component({
  selector: 'wf-scout-result-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <button class="main" (click)="select.emit(place())" [attr.aria-label]="'Open ' + displayName()">
        @if (index()) {
          <span class="order">{{ index() }}</span>
        }
        <span class="dot" [style.background]="categoryColor()"></span>
        <span class="body">
          <span class="name">{{ displayName() }}</span>
          <span class="meta">{{ metaLine() }}</span>
        </span>
      </button>
      <a
        class="maps"
        [href]="mapsUrl()"
        target="_blank"
        rel="noopener noreferrer"
        (click)="$event.stopPropagation()"
        [attr.aria-label]="'Open ' + displayName() + ' in Google Maps'"
        title="Open in Google Maps">↗</a>
    </div>
  `,
  styles: [`
    .card {
      display: flex; align-items: stretch; gap: 4px;
      background: var(--wf-bg);
      border: 0.5px solid var(--wf-hairline);
      border-radius: var(--wf-radius-card, 14px);
      overflow: hidden;
      transition: border-color .15s, box-shadow .15s;
    }
    .card:hover { border-color: var(--wf-accent); box-shadow: 0 3px 14px rgba(0,0,0,0.06); }
    .main {
      flex: 1; min-width: 0;
      display: flex; align-items: center; gap: 12px;
      text-align: left;
      padding: 12px 6px 12px 14px;
      background: transparent; border: none; cursor: pointer;
      min-height: var(--wf-touch, 44px);
    }
    .main:focus-visible { outline: none; box-shadow: var(--wf-ring); border-radius: var(--wf-radius-card, 14px); }
    .order {
      flex: 0 0 auto;
      width: 22px; height: 22px;
      display: grid; place-items: center;
      font-family: var(--wf-font-mono, monospace);
      font-size: 12px; font-weight: 600;
      color: var(--wf-bg);
      background: var(--wf-ink);
      border-radius: 50%;
    }
    .dot { flex: 0 0 auto; width: 9px; height: 9px; border-radius: 50%; }
    .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .name {
      font-family: var(--wf-font-body);
      font-size: 14px; font-weight: 600; color: var(--wf-ink);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .meta {
      font-size: 12px; color: var(--wf-ink-soft);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .maps {
      flex: 0 0 auto;
      width: var(--wf-touch, 44px);
      display: grid; place-items: center;
      color: var(--wf-ink-soft);
      font-size: 16px;
      text-decoration: none;
      border-left: 0.5px solid var(--wf-hairline-soft);
      transition: background .12s, color .12s;
    }
    .maps:hover { background: var(--wf-bg-2); color: var(--wf-accent); }
    .maps:focus-visible { outline: none; box-shadow: var(--wf-ring); }
 
    /* On touch devices, hover transforms don't apply; keep the row calm. */
    @media (hover: none) and (pointer: coarse) {
      .card:hover { box-shadow: none; }
    }
  `],
})
export class ScoutResultCardComponent {
  private categories = inject(CategoriesStore);
  private vibeTags = inject(VibeTagsStore);
 
  readonly place = input.required<Place>();
  readonly index = input<number>(0);
  readonly select = output<Place>();
 
  protected displayName(): string {
    const p = this.place();
    return p.customName?.trim() || p.name;
  }

  protected categoryColor(): string {
    const cat = this.categories.entities().find((c) => c.id === this.place().categoryId);
    return cat?.color ?? 'var(--wf-ink-faint)';
  }
 
  protected mapsUrl(): string {
    return buildPlaceMapsUrl(preferredMapsQuery(this.place()));
  }
 
  protected metaLine(): string {
    const p = this.place();
    const cat = this.categories.entities().find((c) => c.id === p.categoryId);
    const parts: string[] = [];
    if (cat) parts.push(cat.name);
    if (p.locality) parts.push(p.locality);
    const vibes = (p.vibeTagIds ?? [])
      .map((id) => this.vibeTags.entities().find((v) => v.id === id)?.name)
      .filter(Boolean)
      .slice(0, 2);
    if (vibes.length) parts.push(vibes.join(' · '));
    return parts.join('  ·  ');
  }
}
