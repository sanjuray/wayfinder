import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FilterStateStore } from '../../core/stores/filter-state.store';
import { EmptyStateComponent } from './empty-state.component';
import { FilterPopoverComponent } from './filter-popover.component';
import { PIN_ICON_PATHS } from './pin-icons';
import { PlaceDetailComponent } from '../places/place-detail/place-detail.component';
import { QuoteService } from '../../core/services/quote.service';
import { QuoteCardComponent } from './quote-card.component';
import { gradientCss } from '../../core/constants/collection-covers';
import type { CollectionCoverGradient } from '../../core/models';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { PlacesStore } from '../../core/stores/places.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { CollectionsStore } from '../../core/stores/collections.store';
import { VibeTagsStore } from '../../core/stores/vibe-tags.store';

import { AddPlaceComponent } from '../places/add-place/add-place.component';
import { PinDropCelebrationComponent } from '../places/add-place/pin-drop-celebration.component';
import type { Place, Category } from '../../core/models';
import type { EmptyStateVariant } from './empty-state.component';

interface CelebrationState {
  x: number;
  y: number;
  color: string;
  placeName: string;
}

/**
 * Map view — the default child route inside WorkspaceShellComponent.
 *
 * Owns the sidebar (Categories + Collections filter chips), the Leaflet map,
 * the FAB, the filter pill, the place-detail panel, the add-place modal, the
 * pin-drop celebration, and the easter-egg quote card.
 *
 * Does NOT own the topbar — the shell does. The brand, nav tabs, save-status
 * and settings gear live one level up in WorkspaceShellComponent.
 */
@Component({
  selector: 'wf-home',
  standalone: true,
  imports: [
    AddPlaceComponent,
    EmptyStateComponent,
    PinDropCelebrationComponent,
    QuoteCardComponent,
    FilterPopoverComponent,
    PlaceDetailComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild(PlaceDetailComponent) protected placeDetail?: PlaceDetailComponent;

  protected places = inject(PlacesStore);
  protected categories = inject(CategoriesStore);
  protected collections = inject(CollectionsStore);
  protected vibeTags = inject(VibeTagsStore);
  protected filters = inject(FilterStateStore);

  protected quoteService = inject(QuoteService);

  // Easter egg state — the floating quote card
  protected activeQuote = signal<{ text: string; x: number; y: number } | null>(null);

  // Local UI state
  protected showAddModal = signal<boolean>(false);
  protected celebration = signal<CelebrationState | null>(null);
  protected pendingClickCoords = signal<{ lat: number; lng: number } | null>(null);
  protected showFilterPopover = signal(false);
  protected editingPlace = signal<Place | null>(null);
  protected isPlaceDetailOpen = signal(false);

  // Sidebar truncation state — collapsed by default, expand on demand
  protected catExpanded = signal(false);
  protected colExpanded = signal(false);
  protected vibeExpanded = signal(false);

  protected readonly CAT_LIMIT = 6;
  protected readonly COL_LIMIT = 5;
  protected readonly VIBE_LIMIT = 8;

  // Leaflet instance + cluster group, kept as instance fields (not signals)
  // because Leaflet manages its own DOM and we don't want signal reactivity
  // accidentally re-creating markers.
  private map: L.Map | null = null;
  private clusterGroup: L.MarkerClusterGroup | null = null;
  private markersById = new Map<string, L.Marker>();

  protected sortedCategories = computed(() =>
    [...this.categories.entities()]
      .filter((c) => !c.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  protected displayedCategories = computed(() =>
    this.catExpanded()
      ? this.sortedCategories()
      : this.sortedCategories().slice(0, this.CAT_LIMIT)
  );

  protected sortedCollections = computed(() =>
    [...this.collections.entities()].sort((a, b) => a.name.localeCompare(b.name))
  );

  protected displayedCollections = computed(() =>
    this.colExpanded()
      ? this.sortedCollections()
      : this.sortedCollections().slice(0, this.COL_LIMIT)
  );

  protected sortedVibes = computed(() =>
    [...this.vibeTags.entities()]
      .filter((v) => !v.hidden)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  protected displayedVibes = computed(() =>
    this.vibeExpanded()
      ? this.sortedVibes()
      : this.sortedVibes().slice(0, this.VIBE_LIMIT)
  );

  /** Options shape for wf-multi-select in the sidebar. */
  protected vibeOptions = computed(() =>
    this.sortedVibes().map((v) => ({ value: v.id, label: v.name }))
  );

  /** ReadonlySet adapter for wf-multi-select — store keeps string[]. */
  protected selectedVibesSet = computed<ReadonlySet<string>>(
    () => new Set(this.filters.selectedVibeIds())
  );

  protected onSidebarVibeChange(s: ReadonlySet<string>): void {
    this.filters.setSelectedVibeIds([...s]);
  }

  protected categoryCounts = computed(() => {
    const map = new Map<string, number>();
    for (const p of this.places.entities()) {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  });

  protected emptyStateVariant = computed<EmptyStateVariant | null>(() => {
    const filtered = this.filters.filteredPlaces();
    const all = this.places.entities();

    if (all.length === 0) return 'no-places';
    if (filtered.length === 0 && this.filters.anyFilterActive()) return 'no-results';
    return null;
  });

  protected categoryCount(categoryId: string): number {
    return this.places.entities().filter((p) => p.categoryId === categoryId).length;
  }

  constructor() {
    // Whenever places change, sync markers on the map
    effect(() => {
      const filteredPlaces = this.filters.filteredPlaces();
      const categories = this.categories.entities();
      if (this.map && this.clusterGroup) {
        this.syncMarkers(filteredPlaces, categories);
      }
    });

    // ?edit=:id handoff from /places (or any future route that wants to
    // jump back to the map and open a place for editing). Fires once per
    // navigation that carries the param, after the places store has loaded
    // so getById can resolve the id. Then clears the param so a reload
    // doesn't re-trigger.
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    const editId = toSignal(route.queryParamMap, { initialValue: null });
    let handled: string | null = null;
    effect(() => {
      const params = editId();
      const id = params?.get('edit');
      if (!id || handled === id) return;
      const places = this.places.entities();
      if (places.length === 0) return; // wait for store load
      const place = this.places.getById(id);
      if (!place) {
        // id not found — clear the param silently and move on
        handled = id;
        router.navigate([], { queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
        return;
      }
      handled = id;
      this.editingPlace.set(place);
      this.showAddModal.set(true);
      router.navigate([], { queryParams: { edit: null }, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  // ---- Map init ----
  private initMap(): void {
    const map = L.map(this.mapEl.nativeElement, {
      zoomControl: false,
      attributionControl: true,
    }).setView([17.385, 78.4867], 12); // Hyderabad as fallback default

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

    // Click anywhere on the map → open add-place flow with that location
    map.on('click', (e: L.LeafletMouseEvent) => {
      this.pendingClickCoords.set({ lat: e.latlng.lat, lng: e.latlng.lng });
      this.showAddModal.set(true);
    });

    this.map = map;
    this.clusterGroup = cluster;

    // Try to get user's actual location; fall back to Hyderabad silently if denied
    this.tryGeolocate(map);

    // Set up triple-tap detector for the easter egg
    this.setupDoubleTapListener();

    // Initial sync (in case stores already loaded before ngAfterViewInit)
    this.syncMarkers(this.places.entities(), this.categories.entities());
  }

  private syncMarkers(places: Place[], categories: Category[]): void {
    if (!this.clusterGroup) return;

    const catById = new Map(categories.map((c) => [c.id, c]));
    const seen = new Set<string>();

    for (const p of places) {
      seen.add(p.id);
      const existing = this.markersById.get(p.id);
      if (existing) continue; // simplest sync: don't recreate existing markers

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

    // Remove markers for places that no longer exist
    for (const [id, marker] of this.markersById) {
      if (!seen.has(id)) {
        this.clusterGroup.removeLayer(marker);
        this.markersById.delete(id);
      }
    }
  }

  private buildPinIcon(
    color: string,
    iconName: string,
    status: 'planned' | 'visited',
    isFavorite: boolean
  ): L.DivIcon {
    const path = PIN_ICON_PATHS[iconName] ?? PIN_ICON_PATHS['circle'];

    // Favorite ring: rendered first so it sits behind the pin shape
    const favoriteRing = isFavorite
      ? `<path d="M14 2 C7 2 2 7 2 14 C2 23 14 34 14 34 C14 34 26 23 26 14 C26 7 21 2 14 2 Z"
           fill="none" stroke="#FFD15B" stroke-width="5" opacity="0.85"/>`
      : '';

    // Planned dot: top-right corner, teal
    const plannedDot = status === 'planned'
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

  protected onPinClick(placeId: string): void {
    this.placeDetail?.open(placeId);
    this.isPlaceDetailOpen.set(true);
  }

  protected onPlaceDetailClosed(): void {
    this.isPlaceDetailOpen.set(false);
  }

  protected onEditPlace(placeId: string): void {
    const place = this.places.getById(placeId);
    if (!place) return;
    this.editingPlace.set(place);
    this.showAddModal.set(true);
  }

  private tryGeolocate(map: L.Map): void {
    if (!navigator.geolocation) return; // browser doesn't support, stay on default
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Smoothly fly to the user's location
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 13, {
          animate: true,
          duration: 1.0,
        });
      },
      () => {
        // User denied permission or geolocation failed; stay on Hyderabad silently
      },
      { timeout: 5000, maximumAge: 60_000 * 60 } // 5s timeout, cache 1hr
    );
  }

  private setupDoubleTapListener(): void {
    const mapDiv = this.mapEl.nativeElement;
    const tapWindow = 700; // ms — two taps must occur within this window
    const distanceThreshold = 80; // px — taps must land within this radius

    let taps: { time: number; x: number; y: number }[] = [];

    mapDiv.addEventListener(
      'click',
      (e: MouseEvent) => {
        const rect = mapDiv.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const now = Date.now();

        // Drop expired taps
        taps = taps.filter((t) => now - t.time < tapWindow);
        taps.push({ time: now, x, y });

        // Two taps within window AND close together?
        if (taps.length >= 2) {
          const first = taps[0];
          const last = taps[taps.length - 1];
          const dist = Math.sqrt((last.x - first.x) * 2 + (last.y - first.y) * 2);
          if (dist < distanceThreshold) {
            // Double-tap detected — show a quote
            this.handleDoubleTap(e.clientX, e.clientY);
            // Prevent Leaflet's click handler from also opening the add-place modal
            e.stopImmediatePropagation();
          }
          taps = [];
        }
      },
      true // capture phase, runs before Leaflet's own
    );
  }

  private handleDoubleTap(clientX: number, clientY: number): void {
    const text = this.quoteService.pick();
    if (!text) return;
    this.activeQuote.set({ text, x: clientX, y: clientY });
  }

  // ---- UI actions ----
  protected onFabClick(): void {
    this.pendingClickCoords.set(null);
    this.showAddModal.set(true);
  }

  protected onPlaceSaved(place: Place): void {
    this.showAddModal.set(false);
    this.editingPlace.set(null);
    this.pendingClickCoords.set(null);

    const category = this.categories.entities().find((c) => c.id === place.categoryId);
    const color = category?.color ?? '#FF6B5B';

    if (this.map) {
      // Pan to the saved place
      this.map.flyTo([place.lat, place.lng], Math.max(this.map.getZoom(), 14), {
        animate: true,
        duration: 0.6,
      });

      // Wait for fly to settle, then trigger celebration anchored at the pin's pixel coords
      setTimeout(() => {
        if (!this.map) return;
        const point = this.map.latLngToContainerPoint([place.lat, place.lng]);
        const rect = this.mapEl.nativeElement.getBoundingClientRect();
        this.celebration.set({
          x: rect.left + point.x,
          y: rect.top + point.y,
          color,
          placeName: place.name,
        });
      }, 700);
    }
  }
  protected onCelebrationDone(): void {
    this.celebration.set(null);
  }

  protected onCancelAdd(): void {
    this.showAddModal.set(false);
    this.pendingClickCoords.set(null);
    this.editingPlace.set(null);
  }

  protected onQuoteDone(): void {
    this.activeQuote.set(null);
  }

  protected onSidebarCategoryClick(categoryId: string): void {
    this.filters.toggleSidebarCategory(categoryId);
  }

  protected onSidebarCollectionClick(collectionId: string): void {
    this.filters.toggleSidebarCollection(collectionId);
  }

  protected collectionCount(collectionId: string): number {
    return this.places.entities().filter((p) =>
      p.collectionIds.includes(collectionId)
    ).length;
  }

  protected toggleFilterPopover(): void {
    this.showFilterPopover.update((v) => !v);
  }

  protected onFilterPopoverClose(): void {
    this.showFilterPopover.set(false);
  }

  protected clearAllFilters(): void {
    this.filters.clearAll();
  }

  protected onAddPlaceFromEmptyState(): void {
    this.pendingClickCoords.set(null);
    this.showAddModal.set(true);
  }

  /**
   * The active filter pill needs a human-readable summary. This builds it.
   */
  protected filterSummary = computed<string>(() => {
    const catIds = this.filters.selectedCategoryIds();
    const colIds = this.filters.selectedCollectionIds();
    const vibeIds = this.filters.selectedVibeIds();
    const loc = this.filters.selectedLocality();
    const cats = this.categories.entities();
    const cols = this.collections.entities();
    const vibes = this.vibeTags.entities();

    const parts: string[] = [];
    if (catIds.length === 1) {
      parts.push(cats.find((c) => c.id === catIds[0])?.name ?? 'Category');
    } else if (catIds.length > 1) {
      parts.push(`${catIds.length} categories`);
    }

    if (colIds.length === 1) {
      const col = cols.find((c) => c.id === colIds[0]);
      parts.push(col ? `📁 ${col.name}` : 'Collection');
    } else if (colIds.length > 1) {
      parts.push(`${colIds.length} collections`);
    }

    if (vibeIds.length === 1) {
      parts.push(vibes.find((v) => v.id === vibeIds[0])?.name ?? 'Vibe');
    } else if (vibeIds.length > 1) {
      parts.push(`${vibeIds.length} vibes`);
    }

    if (loc) parts.push(loc);

    return parts.join(' · ');
  });

  /** Returns the CSS gradient string for a collection's cover. */
  protected coverGradientFor(c: { coverGradient?: CollectionCoverGradient }): string {
    return gradientCss(c.coverGradient);
  }
}