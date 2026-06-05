import {
  Component,
  inject,
  signal,
  computed,
  afterNextRender,
  Injector,
  ChangeDetectionStrategy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CollectionsStore } from '../../core/stores/collections.store';
import { PlacesStore } from '../../core/stores/places.store';
import { gradientCss } from '../../core/constants/collection-covers';
import type { Collection, CollectionCoverGradient } from '../../core/models';

/**
 * Collections list — the `/collections` route.
 *
 * Grid of cover cards, one per collection, sorted by last-updated (newest first).
 * Each card shows the gradient cover, icon, name, place count, and a relative
 * "updated" timestamp. Click → drill into `/collections/:id`.
 *
 * The trailing "+ New collection" tile uses the spec's expanding-chip pattern:
 * click → name input appears in place → Enter creates → navigates to the new
 * collection's detail page. Escape cancels.
 *
 * Renders inside WorkspaceShellComponent — the topbar handles nav.
 */
@Component({
  selector: 'wf-collections-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collections-list.component.html',
  styleUrl: './collections-list.component.css',
})
export class CollectionsListComponent {
  protected collections = inject(CollectionsStore);
  protected places = inject(PlacesStore);
  private injector = inject(Injector);

  @ViewChild('newNameInput', { static: false })
  private newNameInputRef?: ElementRef<HTMLInputElement>;

  /** Whether the "+ New collection" tile is in expanded (input visible) state. */
  protected expandingNew = signal(false);
  protected newName = signal('');
  protected creating = signal(false);

  /**
   * Cards in display order: newest updated first. Computing on each read is
   * cheap (typical N is < 50) and avoids subscription bookkeeping.
   */
  protected cards = computed<CollectionCard[]>(() => {
    const cols = this.collections.entities();
    const allPlaces = this.places.entities();

    return [...cols]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({
        collection: c,
        placeCount: allPlaces.filter((p) => p.collectionIds.includes(c.id)).length,
        updatedLabel: this.relativeTime(c.updatedAt),
      }));
  });

  /**
   * Aggregate stats shown in the page sub-header.
   * "N collections · M places organized"
   */
  protected stats = computed<string>(() => {
    const cols = this.collections.entities();
    if (cols.length === 0) return 'no collections yet';

    const allPlaces = this.places.entities();
    const placesWithCol = allPlaces.filter((p) => p.collectionIds.length > 0).length;

    const colLabel = cols.length === 1 ? 'collection' : 'collections';
    const placeLabel = placesWithCol === 1 ? 'place' : 'places';
    return `${cols.length} ${colLabel} · ${placesWithCol} ${placeLabel} organized`;
  });

  protected coverFor(gradient: CollectionCoverGradient | undefined): string {
    return gradientCss(gradient);
  }

  protected startNewCollection(): void {
    this.expandingNew.set(true);
    this.newName.set('');
    // Wait for the input to mount in the DOM, then focus it.
    // afterNextRender is the zoneless-safe way to do this — runs after
    // Angular's next render cycle, when the @if branch has materialized.
    afterNextRender(
      () => {
        this.newNameInputRef?.nativeElement.focus();
      },
      { injector: this.injector }
    );
  }

  protected cancelNewCollection(): void {
    this.expandingNew.set(false);
    this.newName.set('');
  }

  protected async confirmNewCollection(): Promise<void> {
    const name = this.newName().trim();
    if (!name || this.creating()) return;

    this.creating.set(true);
    try {
      await this.collections.create(name);
      this.newName.set('');
      this.expandingNew.set(false);
    } finally {
      this.creating.set(false);
    }
  }

  /**
   * Human-readable relative time string.
   * Same flavor as the place-detail "added X days ago" — kept inline here
   * because it's only used in this component. If a 3rd caller appears,
   * lift to a shared util.
   */
  private relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const diffMs = Date.now() - then;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (days < 1) return 'updated today';
    if (days === 1) return 'updated yesterday';
    if (days < 7) return `updated ${days} days ago`;
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `updated ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `updated ${months} ${months === 1 ? 'month' : 'months'} ago`;
    }
    const years = Math.floor(days / 365);
    return `updated ${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
}

interface CollectionCard {
  collection: Collection;
  placeCount: number;
  updatedLabel: string;
}