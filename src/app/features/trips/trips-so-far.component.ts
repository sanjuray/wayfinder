import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TripsStore } from '../../core/stores/trips.store';
import { PlacesStore } from '../../core/stores/places.store';
import { TripCardPreviewComponent } from './trip-card-preview.component';
import {
  TripsFilterPopoverComponent,
  type TripsFilterState,
} from './trips-filter-popover.component';
import { haversineKm } from '../../core/utils/geo';
import type { Trip } from '../../core/models';

/**
 * /trips — the "Trips so far" list. Renders inside WorkspaceShellComponent.
 *
 * Phase 6e: mockup-aligned redesign.
 *   - Richer header subtitle: "N trips · X upcoming · Y in progress"
 *   - Filter popover (search by name + status + travel mode)
 *   - Sections with icon + label + count + horizontal line filler
 *   - "Drafts & undated" replaces "Drafts"
 *   - Each card has a mini SVG map preview (polyline + numbered pins)
 *   - Status pills: 'live' (pulsing) / 'in 3 days' / 'draft' / '9d ago'
 *   - Past trips use teal color for polyline + pins
 *   - "+ New trip" affordance card lives at the end of the Drafts section
 *
 * Deferred to a separate phase (was discussed but explicitly out of scope):
 *   - Live trip mechanism: starting a trip, marking stops visited during
 *     a trip, moving avatar marker, split visited/remaining polyline.
 *     Touches Trip model (new startedAt field), TripStop usage, the
 *     planner UI, and the polyline rendering. Own phase.
 *
 * The class stays named TripsSoFarComponent — the route binding wouldn't
 * survive renaming, and the section title still reads "Trips so far."
 */
@Component({
  selector: 'wf-trips-so-far',
  standalone: true,
  imports: [
    FormsModule,
    TripCardPreviewComponent,
    TripsFilterPopoverComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trips-so-far.component.html',
  styleUrls: ['./trips-so-far.component.css'],
})
export class TripsSoFarComponent {
  protected trips = inject(TripsStore);
  protected places = inject(PlacesStore);
  private router = inject(Router);

  // ---- Inline create ----

  protected creating = signal(false);
  protected newName = signal('');
  protected saving = signal(false);

  // ---- Filter state ----

  protected showFilter = signal(false);
  protected filter = signal<TripsFilterState>({
    query: '',
    statuses: new Set(),
    travelModes: new Set(),
  });

  /** Constant empty Set for template "clear filters" handler. */
  protected readonly emptySet: ReadonlySet<string> = new Set();

  protected anyFilterActive = computed(() => {
    const f = this.filter();
    return (
      f.query.trim().length > 0 ||
      f.statuses.size > 0 ||
      f.travelModes.size > 0
    );
  });

  /** True iff at least one section in the current sections() has any items. */
  protected hasAnyMatches = computed(() =>
    this.sections().some((s) => s.items.length > 0)
  );

  // ---- Subtitle counts ----

  protected totalCount = computed(() => this.trips.entities().length);
  protected upcomingCount = computed(() => this.trips.upcoming().length);
  protected inProgressCount = computed(() => this.trips.inProgress().length);

  /**
   * Subtitle composition matching the mockup: "14 trips · 5 upcoming · 1 in progress".
   * Hidden parts when their count is zero (no "0 upcoming" noise).
   */
  protected subtitle = computed<string>(() => {
    const parts: string[] = [];
    const total = this.totalCount();
    parts.push(`${total} ${total === 1 ? 'trip' : 'trips'}`);
    const upc = this.upcomingCount();
    if (upc > 0) parts.push(`${upc} upcoming`);
    const ip = this.inProgressCount();
    if (ip > 0) parts.push(`${ip} in progress`);
    return parts.join(' · ');
  });

  // ---- Sections ----

  /**
   * Trip sections in render order with mockup-aligned metadata (icon and
   * color hint via the .accent class on the section icon). Each section's
   * items are filtered through the current filter state.
   */
  protected sections = computed(() => {
    const f = this.filter();
    return [
      {
        key: 'in-progress',
        label: 'In progress',
        icon: 'ti-player-play',
        accent: 'teal' as const,
        items: this.applyFilter(this.trips.inProgress(), f, 'in-progress'),
      },
      {
        key: 'upcoming',
        label: 'Upcoming',
        icon: 'ti-calendar-event',
        accent: 'accent' as const,
        items: this.applyFilter(this.trips.upcoming(), f, 'upcoming'),
      },
      {
        key: 'drafts',
        label: 'Drafts & undated',
        icon: 'ti-edit',
        accent: 'soft' as const,
        items: this.applyFilter(this.trips.drafts(), f, 'draft'),
      },
      {
        key: 'past',
        label: 'Past',
        icon: 'ti-history',
        accent: 'soft' as const,
        items: this.applyFilter(this.trips.past(), f, 'past'),
      },
    ];
  });

  // ---- Filtering ----

  private applyFilter(
    items: Trip[],
    f: TripsFilterState,
    sectionKey: string
  ): Trip[] {
    // Skip the whole section if a status filter is active and excludes us
    if (f.statuses.size > 0 && !f.statuses.has(sectionKey)) return [];

    return items.filter((t) => {
      if (f.travelModes.size > 0 && !f.travelModes.has(t.defaultTravelMode)) {
        return false;
      }
      if (f.query.trim()) {
        const q = f.query.trim().toLowerCase();
        if (!t.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  // ---- Create flow ----

  /**
   * Error message shown under the create-name input. Null when no error.
   * Set when the user types a name that collides with an existing trip,
   * or when create() throws DUPLICATE_TRIP_NAME on submit.
   */
  protected createNameError = signal<string | null>(null);

  protected startCreating(): void {
    this.creating.set(true);
    this.newName.set('');
    this.createNameError.set(null);
  }

  protected cancelCreating(): void {
    this.creating.set(false);
    this.newName.set('');
    this.createNameError.set(null);
  }

  /**
   * Live name check: called from (ngModelChange) on the create input.
   * Clears the error if the user has typed something new + unique.
   */
  protected onNewNameChange(name: string): void {
    this.newName.set(name);
    const trimmed = name.trim();
    if (!trimmed) {
      this.createNameError.set(null);
    } else if (!this.trips.nameAvailable(trimmed)) {
      this.createNameError.set('A trip with this name already exists.');
    } else {
      this.createNameError.set(null);
    }
  }

  protected async confirmCreate(): Promise<void> {
    const name = this.newName().trim();
    if (!name || this.saving()) return;
    // Pre-check, so the user sees the error before we attempt the create.
    if (!this.trips.nameAvailable(name)) {
      this.createNameError.set('A trip with this name already exists.');
      return;
    }
    this.saving.set(true);
    try {
      const trip = await this.trips.create(name);
      this.creating.set(false);
      this.newName.set('');
      this.createNameError.set(null);
      this.router.navigate(['/trips', trip.id]);
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_TRIP_NAME') {
        this.createNameError.set('A trip with this name already exists.');
      } else {
        throw err;
      }
    } finally {
      this.saving.set(false);
    }
  }

  // ---- Row interaction ----

  protected openTrip(t: Trip): void {
    this.router.navigate(['/trips', t.id]);
  }

  // ---- Filter popover ----

  protected toggleFilter(event: MouseEvent): void {
    event.stopPropagation();
    this.showFilter.update((v) => !v);
  }

  protected onFilterChange(next: TripsFilterState): void {
    this.filter.set(next);
  }

  protected onFilterClosed(): void {
    this.showFilter.set(false);
  }

  // ---- Card display helpers ----

  /**
   * Coordinates of every stop in the trip (in order), resolved through
   * the places store. Stops whose place was deleted are dropped — the
   * preview is informational, not authoritative.
   */
  protected stopCoords(t: Trip): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (const stop of t.stops) {
      const place = this.places.getById(stop.placeId);
      if (place) out.push([place.lat, place.lng]);
    }
    return out;
  }

  /** Visual variant for the mini-map preview given a section key. */
  protected previewVariant(
    sectionKey: string
  ): 'default' | 'draft' | 'past' {
    if (sectionKey === 'past') return 'past';
    if (sectionKey === 'drafts') return 'draft';
    return 'default';
  }

  /**
   * Status pill copy for a trip given its section. Empty string means
   * "no pill" (e.g. in-progress draws a custom 'live' pulse instead — we
   * still want the pill, just want different content).
   */
  protected pillText(t: Trip, sectionKey: string): string {
    switch (sectionKey) {
      case 'in-progress':
        return 'live';
      case 'upcoming':
        return this.countdownLabel(t.plannedDate);
      case 'drafts':
        return 'draft';
      case 'past':
        return this.relativePastLabel(t.plannedDate ?? t.updatedAt);
      default:
        return '';
    }
  }

  /**
   * "in 3 days" / "tomorrow" / "today" given an ISO date. Used for
   * Upcoming pills. If the date is invalid or already passed, returns
   * 'soon' as a safe fallback (the trip shouldn't be in Upcoming in
   * that case anyway — store getter filters by date).
   */
  private countdownLabel(iso: string | undefined): string {
    if (!iso) return 'soon';
    const target = new Date(iso).getTime();
    if (!Number.isFinite(target)) return 'soon';
    const now = Date.now();
    const day = 86_400_000;
    const diffDays = Math.round((target - now) / day);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 30) return `in ${diffDays} days`;
    const weeks = Math.round(diffDays / 7);
    if (weeks < 6) return `in ${weeks}w`;
    const months = Math.round(diffDays / 30);
    return `in ${months}mo`;
  }

  /**
   * Relative-past pill: "today" / "yesterday" / "9d ago" / "3w ago" /
   * "2 mo ago" / "1y ago". Mirrors the mockup tone.
   */
  private relativePastLabel(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const diff = Math.max(0, Date.now() - then);
    const day = 86_400_000;
    if (diff < day) return 'today';
    if (diff < 2 * day) return 'yesterday';
    const days = Math.floor(diff / day);
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)} mo ago`;
    return `${Math.floor(days / 365)}y ago`;
  }

  /**
   * Friendly date for the info-line below the trip name. "sat, may 16"
   * style. Returns null when no plannedDate (caller shows "no date"
   * instead, with an offset calendar icon).
   */
  protected datePretty(iso: string | undefined): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d
      .toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      .toLowerCase();
  }

  /** "X stops" or "1 stop". */
  protected stopCountLabel(t: Trip): string {
    const n = t.stops.length;
    return `${n} ${n === 1 ? 'stop' : 'stops'}`;
  }

  /**
   * Phase 7: count of stops marked visited during this trip. Drives the
   * in-progress card's progress bar. The mini-map preview reads the
   * same count via `currentVisitedIndex` (below).
   */
  protected visitedCount(t: Trip): number {
    return t.stops.filter((s) => s.visitedDuringTrip).length;
  }

  /**
   * Index of the most-recently visited stop in `t.stops`, or null if
   * none. Used by trip-card-preview to split the polyline into
   * visited/remaining. Sorts by visitedAt to handle out-of-order marks;
   * falls back to array order when timestamps are missing or equal.
   */
  protected currentVisitedIndex(t: Trip): number | null {
    let bestIdx: number | null = null;
    let bestAt = '';
    t.stops.forEach((s, i) => {
      if (!s.visitedDuringTrip) return;
      const at = s.visitedAt ?? '';
      if (
        bestIdx === null ||
        at > bestAt ||
        (at === bestAt && i > bestIdx)
      ) {
        bestIdx = i;
        bestAt = at;
      }
    });
    return bestIdx;
  }

  /**
   * Total straight-line distance across all legs in km, rounded to one
   * decimal. Returns null when fewer than 2 stops. Uses the same
   * haversine util the planner uses — keeps cards consistent with what
   * the planner shows.
   */
  protected totalDistance(t: Trip): string | null {
    const coords = this.stopCoords(t);
    if (coords.length < 2) return null;
    let km = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      km += haversineKm(
        { lat: coords[i][0], lng: coords[i][1] },
        { lat: coords[i + 1][0], lng: coords[i + 1][1] }
      );
    }
    if (km < 1) return `${Math.round(km * 1000)} m*`;
    return `${km.toFixed(1)} km*`;
  }

  /**
   * Tabler icon class for a travel mode, used as a small pip in the
   * card's info-line. Matches the planner's leg-icon mapping.
   */
  protected travelModeIcon(t: Trip): string {
    switch (t.defaultTravelMode) {
      case 'walking': return 'ti-walk';
      case 'driving': return 'ti-car';
      case 'motorcycle': return 'ti-motorbike';
      case 'transit': return 'ti-bus';
      case 'auto':
      default:        return 'ti-route';
    }
  }
}