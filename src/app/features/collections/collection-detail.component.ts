import {
  Component,
  inject,
  signal,
  computed,
  effect,
  input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  afterNextRender,
  HostListener,
  Injector,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { CollectionsStore } from '../../core/stores/collections.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { VibeTagsStore } from '../../core/stores/vibe-tags.store';
import { TripsStore } from '../../core/stores/trips.store';
import { gradientCss } from '../../core/constants/collection-covers';
import { CollectionEditFacade } from './collection-edit.facade';
import { GradientPickerComponent } from '../../shared/gradient-picker/gradient-picker.component';
import { IconPickerComponent } from '../../shared/icon-picker/icon-picker.component';
import { PlaceDetailComponent } from '../places/place-detail/place-detail.component';
import { PIN_ICON_PATHS } from '../home/pin-icons';
import type { Category, Place } from '../../core/models';

/**
 * Collection detail — the `/collections/:id` route.
 *
 * Layout: header bar with cover swatch + name + count + edit controls, then
 * a 2-column grid below (1fr left for place list, 1.2fr right for map per
 * mockup `coll-grid`).
 *
 * The page mounts its own Leaflet map showing only the places tagged with
 * this collection. Clicking a list row flies the map to that pin and opens
 * the existing `<wf-place-detail>` panel — same UX as on the main map view.
 *
 * Removing a place from the collection triggers an undo toast at the bottom.
 * The facade owns the undo timer; the component just renders the toast and
 * forwards the dismiss/undo actions.
 *
 * Renders inside WorkspaceShellComponent — the topbar handles nav.
 */
@Component({
  selector: 'wf-collection-detail',
  standalone: true,
  providers: [CollectionEditFacade],
  imports: [
    FormsModule,
    RouterLink,
    GradientPickerComponent,
    IconPickerComponent,
    PlaceDetailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './collection-detail.component.html',
  styleUrl: './collection-detail.component.css',
})
export class CollectionDetailComponent implements AfterViewInit, OnDestroy {
  /** Route param, bound automatically by withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected facade = inject(CollectionEditFacade);
  protected collections = inject(CollectionsStore);
  protected categories = inject(CategoriesStore);
  protected vibeTags = inject(VibeTagsStore);
  protected tripsStore = inject(TripsStore);
  private router = inject(Router);
  private injector = inject(Injector);

  @ViewChild('mapEl', { static: false }) mapEl?: ElementRef<HTMLDivElement>;
  @ViewChild('nameInput', { static: false })
  private nameInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild(PlaceDetailComponent) protected placeDetail?: PlaceDetailComponent;

  /** Leaflet state — not signals, Leaflet owns its own DOM. */
  private map: L.Map | null = null;
  private clusterGroup: L.MarkerClusterGroup | null = null;
  private markersById = new Map<string, L.Marker>();

  protected isPlaceDetailOpen = signal(false);

  /** Tiny dropdown next to "Cover" button — Change gradient / Change icon. */
  protected showCoverMenu = signal(false);

  /** "•••" overflow menu in the action row — currently only contains Delete. */
  protected showOverflowMenu = signal(false);

  /** Computed gradient CSS for the cover swatch. */
  protected coverCss = computed<string>(() =>
    gradientCss(this.facade.collection()?.coverGradient)
  );

  /**
   * Category lookup by id — feeds the rotated diamond icon tiles in the list.
   * Place rows show the category's color + icon, matching how pins look on the map.
   */
  protected categoryById = computed<Map<string, { color: string; icon: string }>>(() => {
    const map = new Map<string, { color: string; icon: string }>();
    for (const c of this.categories.entities()) {
      map.set(c.id, { color: c.color, icon: c.icon ?? 'circle' });
    }
    return map;
  });

  /** Vibe tag name lookup — used for the meta line under each place name. */
  protected vibeTagNameById = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const v of this.vibeTags.entities()) {
      map.set(v.id, v.name);
    }
    return map;
  });

  /**
   * Stats line shown under the collection name (mirrors mockup):
   *   N places · N visited · N favorites · updated X ago
   */
  protected stats = computed(() => {
    const places = this.facade.placesInCollection();
    const visited = places.filter((p) => p.status === 'visited').length;
    const favorites = places.filter((p) => p.isFavorite).length;
    const c = this.facade.collection();
    return {
      total: places.length,
      visited,
      favorites,
      updatedLabel: c ? this.relativeTime(c.updatedAt) : '',
    };
  });

  private relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return '';
    const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
    if (days < 1) return 'updated today';
    if (days === 1) return 'updated yesterday';
    if (days < 7) return `updated ${days} days ago`;
    if (days < 30) {
      const w = Math.floor(days / 7);
      return `updated ${w} ${w === 1 ? 'week' : 'weeks'} ago`;
    }
    if (days < 365) {
      const m = Math.floor(days / 30);
      return `updated ${m} ${m === 1 ? 'month' : 'months'} ago`;
    }
    const y = Math.floor(days / 365);
    return `updated ${y} ${y === 1 ? 'year' : 'years'} ago`;
  }

  /** Limit the meta line to keep it readable — show at most this many vibe tags. */
  protected readonly MAX_VIBE_TAGS_IN_ROW = 1;

  /** Resolve the vibe-tag names to show on a single place row. */
  protected vibeTagsFor(tagIds: string[]): string[] {
    const lookup = this.vibeTagNameById();
    return tagIds
      .map((id) => lookup.get(id))
      .filter((n): n is string => !!n)
      .slice(0, this.MAX_VIBE_TAGS_IN_ROW);
  }

  constructor() {
    // Bind facade to route id whenever id changes (e.g. navigating from
    // /collections/a directly to /collections/b without unmounting).
    effect(() => {
      const id = this.id();
      this.facade.load(id);

      // If the collection doesn't exist (or was deleted), bounce to the list.
      // Defer to avoid running during change detection.
      queueMicrotask(() => {
        const exists = this.collections.entities().some((c) => c.id === id);
        if (!exists) {
          this.router.navigate(['/collections']);
        }
      });
    });

    // Whenever this collection's places change, sync map markers.
    effect(() => {
      const placesList = this.facade.placesInCollection();
      const cats = this.categories.entities();
      if (this.map && this.clusterGroup) {
        this.syncMarkers(placesList, cats);
        this.fitBoundsIfPossible(placesList);
      }
    });

    // When the @if branch around the page template materializes, mapEl
    // becomes available. Try to init the map then. Re-checks on each
    // render until mapEl is present and the map gets created.
    effect(() => {
      const col = this.facade.collection();
      if (col && !this.map) {
        afterNextRender(() => this.tryInitMap(), { injector: this.injector });
      }
    });

    // Focus the name input when entering edit mode.
    effect(() => {
      if (this.facade.editingName()) {
        afterNextRender(
          () => {
            const el = this.nameInputRef?.nativeElement;
            if (el) {
              el.focus();
              el.select();
            }
          },
          { injector: this.injector }
        );
      }
    });
  }

  ngAfterViewInit(): void {
    // mapEl may not be present yet because of the @if around the template.
    // The constructor effect on facade.collection() re-tries init when the
    // template materializes.
    this.tryInitMap();
  }

  private tryInitMap(): void {
    if (this.map) return; // already initialized
    if (!this.mapEl) return; // not mounted yet — effect will retry
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  // ============================================================
  // MAP
  // ============================================================

  private initMap(): void {
    if (!this.mapEl) return;
    const map = L.map(this.mapEl.nativeElement, {
      zoomControl: false,
      attributionControl: true,
    }).setView([17.385, 78.4867], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
    });
    map.addLayer(cluster);

    this.map = map;
    this.clusterGroup = cluster;

    // Initial sync — places might already be loaded
    this.syncMarkers(this.facade.placesInCollection(), this.categories.entities());
    this.fitBoundsIfPossible(this.facade.placesInCollection());
  }

  private syncMarkers(places: Place[], categories: Category[]): void {
    if (!this.clusterGroup) return;

    const catById = new Map(categories.map((c) => [c.id, c]));
    const seen = new Set<string>();

    for (const p of places) {
      seen.add(p.id);
      if (this.markersById.has(p.id)) continue;

      const cat = catById.get(p.categoryId);
      const color = cat?.color ?? '#FF6B5B';

      const marker = L.marker([p.lat, p.lng], {
        icon: this.buildPinIcon(color, cat?.icon ?? 'circle', p.status, p.isFavorite),
        title: p.customName ?? p.name,
      });

      marker.on('click', () => this.onPinClick(p.id));

      this.clusterGroup.addLayer(marker);
      this.markersById.set(p.id, marker);
    }

    // Drop markers for places no longer in this collection
    for (const [id, marker] of this.markersById) {
      if (!seen.has(id)) {
        this.clusterGroup.removeLayer(marker);
        this.markersById.delete(id);
      }
    }
  }

  /**
   * Same pin SVG as home — single source would be nicer (extracted to a
   * shared util), but Phase 4 ships first; v2 refactor can dedupe.
   */
  private buildPinIcon(
    color: string,
    iconName: string,
    status: 'planned' | 'visited',
    isFavorite: boolean
  ): L.DivIcon {
    const path = PIN_ICON_PATHS[iconName] ?? PIN_ICON_PATHS['circle'];
    const favoriteRing = isFavorite
      ? `<path d="M14 2 C7 2 2 7 2 14 C2 23 14 34 14 34 C14 34 26 23 26 14 C26 7 21 2 14 2 Z"
           fill="none" stroke="#FFD15B" stroke-width="5" opacity="0.85"/>`
      : '';
    const plannedDot =
      status === 'planned'
        ? `<circle cx="25" cy="3" r="4.5" fill="#1D9E75" stroke="#fff" stroke-width="1.2"/>`
        : '';

    return L.divIcon({
      className: 'wf-pin-icon',
      html: `
        <svg width="32" height="40" viewBox="-5 -5 38 46" xmlns="http://www.w3.org/2000/svg" overflow="visible">
          ${favoriteRing}
          <path d="M14 2 C7 2 2 7 2 14 C2 23 14 34 14 34 C14 34 26 23 26 14 C26 7 21 2 14 2 Z"
            fill="${color}" stroke="${color}" stroke-width="2"/>
          <g transform="translate(7, 7) scale(0.6)" stroke="#fff" stroke-width="2"
             fill="none" stroke-linecap="round" stroke-linejoin="round">
            ${path}
          </g>
          ${plannedDot}
        </svg>`,
      iconSize: [32, 40],
      iconAnchor: [14, 36],
    });
  }

  /** Fit the map view to all this collection's pins (with padding). */
  private fitBoundsIfPossible(places: Place[]): void {
    if (!this.map || places.length === 0) return;
    if (places.length === 1) {
      this.map.setView([places[0].lat, places[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]));
    this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  protected onListRowClick(place: Place): void {
    if (!this.map) return;
    this.map.flyTo([place.lat, place.lng], Math.max(this.map.getZoom(), 14), {
      animate: true,
      duration: 0.6,
    });
    this.placeDetail?.open(place.id);
    this.isPlaceDetailOpen.set(true);
  }

  protected onPinClick(placeId: string): void {
    this.placeDetail?.open(placeId);
    this.isPlaceDetailOpen.set(true);
  }

  protected onPlaceDetailClosed(): void {
    this.isPlaceDetailOpen.set(false);
  }

  protected onEditPlace(placeId: string): void {
    // Editing a place from this view isn't supported in v1 — the add-place
    // modal lives on the home route. Navigate there so the user can edit
    // from the place-detail panel that opens on pin click.
    // (Future: lift the add-place modal into the workspace shell so any
    // route can host it. Tracked separately.)
    this.router.navigate(['/']);
  }

  protected async onConfirmDelete(): Promise<void> {
    const ok = await this.facade.deleteCollection();
    if (ok) {
      this.router.navigate(['/collections']);
    }
  }

  // ============================================================
  // SMALL MENUS — Cover (gradient/icon) and overflow (•••)
  // ============================================================

  /**
   * Toggle the Cover popover. stopPropagation so the click doesn't bubble to
   * the document handler below and immediately close what we just opened.
   */
  protected toggleCoverMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showCoverMenu.update((v) => !v);
    this.showOverflowMenu.set(false);
  }

  protected toggleOverflowMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showOverflowMenu.update((v) => !v);
    this.showCoverMenu.set(false);
  }

  protected pickGradientFromMenu(): void {
    this.showCoverMenu.set(false);
    this.facade.showGradientPicker.set(true);
  }

  protected pickIconFromMenu(): void {
    this.showCoverMenu.set(false);
    this.facade.showIconPicker.set(true);
  }

  protected deleteFromOverflow(): void {
    this.showOverflowMenu.set(false);
    this.facade.showDeleteConfirm.set(true);
  }

  /**
   * Create a new empty draft trip named after this collection and
   * navigate the user into the planner. Per the product decision in
   * Phase 6c, we do NOT pre-populate stops — the user explicitly asks
   * for stops via "+ Add stop" in the planner. This keeps the action
   * lightweight (no surprise list of 20 stops to prune) and avoids
   * picking an order on the user's behalf.
   */
  protected async onPlanTrip(): Promise<void> {
    const col = this.facade.collection();
    if (!col) return;
    const tripName = `Trip in ${col.name}`;
    const trip = await this.tripsStore.create(tripName);
    this.router.navigate(['/trips', trip.id]);
  }

  /** Click anywhere closes any open small menu. */
  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.showCoverMenu()) this.showCoverMenu.set(false);
    if (this.showOverflowMenu()) this.showOverflowMenu.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.showCoverMenu()) this.showCoverMenu.set(false);
    if (this.showOverflowMenu()) this.showOverflowMenu.set(false);
  }
}