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
import { PIN_ICON_PATHS } from './pin-icons';
import { QuoteService } from '../../core/services/quote.service';
import { QuoteCardComponent } from './quote-card.component';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import 'leaflet.markercluster';

import { PlacesStore } from '../../core/stores/places.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { CollectionsStore } from '../../core/stores/collections.store';
import { TaglineService } from '../../core/services/tagline.service';
import { AppStateStore } from '../../core/stores/app-state.store';

import { AddPlaceComponent } from '../places/add-place/add-place.component';
import { PinDropCelebrationComponent } from '../places/add-place/pin-drop-celebration.component';
import type { Place, Category } from '../../core/models';
import { AddPlaceFacade } from '../places/add-place/add-place.facade';

interface CelebrationState {
  x: number;
  y: number;
  color: string;
  placeName: string;
}

@Component({
  selector: 'wf-home',
  standalone: true,
  imports: [RouterLink, AddPlaceComponent, PinDropCelebrationComponent, QuoteCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;

  protected places = inject(PlacesStore);
  protected categories = inject(CategoriesStore);
  protected collections = inject(CollectionsStore);

  protected appState = inject(AppStateStore);
  protected tagline = inject(TaglineService);
  protected quoteService = inject(QuoteService);

  // Easter egg state — the floating quote card
  protected activeQuote = signal<{ text: string; x: number; y: number } | null>(null);

  // Local UI state
  protected showAddModal = signal<boolean>(false);
  protected celebration = signal<CelebrationState | null>(null);
  protected pendingClickCoords = signal<{ lat: number; lng: number } | null>(null);

  // Leaflet instance + cluster group, kept as instance fields (not signals)
  // because Leaflet manages its own DOM and we don't want signal reactivity
  // accidentally re-creating markers.
  private map: L.Map | null = null;
  private clusterGroup: L.MarkerClusterGroup | null = null;
  private markersById = new Map<string, L.Marker>();

  protected sortedCategories = computed(() =>
    [...this.categories.entities()].sort((a, b) => a.name.localeCompare(b.name))
  );

  protected sortedCollections = computed(() =>
    [...this.collections.entities()].sort((a, b) => a.name.localeCompare(b.name))
  );

  protected categoryCounts = computed(() => {
    const map = new Map<string, number>();
    for (const p of this.places.entities()) {
      map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    }
    return map;
  });

  constructor() {
    // Whenever places change, sync markers on the map
    effect(() => {
      const places = this.places.entities();
      const categories = this.categories.entities();
      if (this.map && this.clusterGroup) {
        this.syncMarkers(places, categories);
      }
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
    this.setupTripleTapListener();

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
        title: p.name,
      });

      marker.bindPopup(this.popupHtml(p, cat?.name ?? ''));

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

  private popupHtml(p: Place, catName: string): string {
    const safe = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return `
      <strong>${safe(p.name)}</strong><br/>
      <span style="font-size:11px; color:#666;">
        ${safe(catName)} · ${safe(p.locality)}
      </span>
    `;
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

  private setupTripleTapListener(): void {
    const mapDiv = this.mapEl.nativeElement;
    const tapWindow = 700; // ms — three taps must occur within this window
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

        // Three taps within window AND close together?
        if (taps.length >= 3) {
          const first = taps[0];
          const last = taps[taps.length - 1];
          const dist = Math.sqrt((last.x - first.x) * 2 + (last.y - first.y) * 2);
          if (dist < distanceThreshold) {
            // Triple-tap detected — show a quote
            this.handleTripleTap(e.clientX, e.clientY);
            // Prevent Leaflet's click handler from also opening the add-place modal
            e.stopImmediatePropagation();
          }
          taps = [];
        }
      },
      true // capture phase, runs before Leaflet's own
    );
  }

  private handleTripleTap(clientX: number, clientY: number): void {
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
  }

  protected onQuoteDone(): void {
    this.activeQuote.set(null);
  }
}