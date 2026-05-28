import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  input,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  CdkDropList,
  CdkDragDrop,
} from '@angular/cdk/drag-drop';
import * as L from 'leaflet';

import { PlacesStore } from '../../core/stores/places.store';
import { CategoriesStore } from '../../core/stores/categories.store';
import { TripsStore } from '../../core/stores/trips.store';

import { TripPlanFacade } from './trip-plan.facade';
import { TripStopCardComponent } from './trip-stop-card.component';
import { PickerColumnComponent } from './picker-column.component';
import { DeleteConfirmComponent } from '../places/place-detail/delete-confirm.component';
import { PlaceDetailComponent } from '../places/place-detail/place-detail.component';
import { AddPlaceComponent } from '../places/add-place/add-place.component';

import {
  haversineKm,
  travelMinutes,
  formatDistanceKm,
  formatMinutes,
} from '../../core/utils/geo';
import {
  buildGoogleMapsUrl,
  splitForGoogleMaps,
  GOOGLE_MAPS_MAX_STOPS,
  type GoogleMapsStop,
} from '../../core/utils/google-maps-export';
import { preferredMapsQuery } from '../../core/utils/place-maps-query';

import type { TravelMode } from '../../core/models';

/**
 * /trips/:id — the trip planner. Phase 6c restructure to match the mockup:
 *
 *   ┌──────────────────────────┬─────────────────────────────────┐
 *   │ LEFT: stops column       │ RIGHT: map                       │
 *   │  ← trips so far          │  numbered pins + dashed Bezier   │
 *   │  Trip name (editable)    │                                  │
 *   │  📅 date · N stops       │                                  │
 *   │                          │                                  │
 *   │  [stop 1]                │                                  │
 *   │   leg: 2.4 km ~28 min    │                                  │
 *   │  [stop 2]                │                                  │
 *   │   ...                    │                                  │
 *   │  [stop N]                │                                  │
 *   │                          │                                  │
 *   │  + Add stop              │                                  │
 *   │                          │                                  │
 *   │  Totals (km, min, stops) │                                  │
 *   │  *disclaimer             │                                  │
 *   │  Open as: [mode v]       │                                  │
 *   │  [Open in Google Maps]   │                                  │
 *   │                          │                                  │
 *   │  Notes…                  │                                  │
 *   │                          │                                  │
 *   │  [Complete] [Delete]     │                                  │
 *   └──────────────────────────┴─────────────────────────────────┘
 *
 * Picker is a modal popover triggered by "+ Add stop", not a permanent
 * sidebar. Filter chips inside the popover use LOCAL filter state — they
 * don't touch the global FilterStateStore (which drives the home map).
 *
 * Distances are straight-line via haversine; "time" is distance / mode
 * speed. The disclaimer next to the totals block makes this explicit. The
 * primary action is "Open trip in Google Maps" which opens a directions
 * URL with stops as waypoints.
 */
@Component({
  selector: 'wf-trip-plan',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TripPlanFacade],
  imports: [
    FormsModule,
    RouterLink,
    CdkDropList,
    TripStopCardComponent,
    PickerColumnComponent,
    DeleteConfirmComponent,
    PlaceDetailComponent,
    AddPlaceComponent,
  ],
  templateUrl: './trip-plan.component.html',
  styleUrls: ['./trip-plan.component.css'],
})
export class TripPlanComponent implements OnDestroy {
  /** Route param. Provided by withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected facade = inject(TripPlanFacade);
  protected places = inject(PlacesStore);
  protected categories = inject(CategoriesStore);
  protected trips = inject(TripsStore);
  private router = inject(Router);

  /**
   * Map element reference. Signal-based — updates when the @else branch
   * mounts (i.e., after facade.loaded() becomes true). See HISTORY: the
   * old @ViewChild + ngAfterViewInit approach failed because the map div
   * is inside an @if/@else block — the element doesn't exist when ngAfter
   * fires. viewChild() + an effect handles that correctly.
   */
  private mapElRef = viewChild<ElementRef<HTMLDivElement>>('mapEl');

  /**
   * Reference to the mounted PlaceDetailComponent. Pin clicks call open()
   * on this; the panel's own outputs handle close + edit-request.
   */
  private placeDetailRef = viewChild<PlaceDetailComponent>(PlaceDetailComponent);

  /** Same idea, exposed to the imperative handlers below. */
  protected get placeDetail(): PlaceDetailComponent | undefined {
    return this.placeDetailRef();
  }

  // ---- UI state ----

  protected editingName = signal(false);
  protected nameDraft = signal('');
  protected notesDraft = signal('');
  protected showDeleteConfirm = signal(false);
  /** Picker column slide-in/out state. Phase 6d: was a popover in 6c. */
  protected showPicker = signal(false);
  /**
   * Add-place modal for the "+ Save a new place" flow inside the picker.
   * When set, mounts <wf-add-place>; on (saved) we add the new place as a
   * stop and dismiss.
   */
  protected showAddPlace = signal(false);

  protected categoryById = computed(() => {
    const m = new Map<string, ReturnType<typeof this.findCategory>>();
    for (const c of this.categories.entities()) m.set(c.id, c);
    return m;
  });

  private findCategory(id: string) {
    return this.categories.entities().find((c) => c.id === id);
  }

  // ---- Derived: legs and totals ----

  /**
   * Legs between consecutive stops, with distance + time per leg. The
   * length is `stops.length - 1` (one fewer than stops). Time depends on
   * the trip's defaultTravelMode.
   */
  protected legs = computed<Array<{ km: number; minutes: number }>>(() => {
    const stops = this.facade.stopsWithPlace();
    const mode = this.facade.trip()?.defaultTravelMode ?? 'auto';
    const legs: Array<{ km: number; minutes: number }> = [];
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i].place;
      const b = stops[i + 1].place;
      if (!a || !b) {
        legs.push({ km: 0, minutes: 0 });
        continue;
      }
      const km = haversineKm(a, b);
      const minutes = travelMinutes(km, mode);
      legs.push({ km, minutes });
    }
    return legs;
  });

  protected totals = computed(() => {
    let km = 0;
    let minutes = 0;
    for (const l of this.legs()) {
      km += l.km;
      minutes += l.minutes;
    }
    return {
      km,
      minutes,
      stopCount: this.facade.trip()?.stops.length ?? 0,
    };
  });

  /** Friendly date label "sat, may 16" lowercased to match mockup tone. */
  protected dateLabel = computed<string | null>(() => {
    const iso = this.facade.trip()?.plannedDate;
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
  });

  // Expose util functions to the template
  protected formatDistance = formatDistanceKm;
  protected formatTime = formatMinutes;

  /**
   * Tabler icon class for a travel mode — used in the leg separators
   * between stops. Auto-mode gets the generic route icon since we don't
   * know which mode Google will pick.
   */
  protected legIcon(mode: TravelMode): string {
    switch (mode) {
      case 'walking': return 'ti-walk';
      case 'driving': return 'ti-car';
      case 'cycling': return 'ti-bike';
      case 'transit': return 'ti-bus';
      case 'auto':
      default:        return 'ti-route';
    }
  }

  /** Plain-language label for the totals row's "Estimated time" line. */
  protected travelLabel(mode: TravelMode): string {
    switch (mode) {
      case 'walking': return 'walking';
      case 'driving': return 'driving';
      case 'cycling': return 'cycling';
      case 'transit': return 'on transit';
      case 'auto':
      default:        return 'mixed';
    }
  }

  // ---- Google Maps export ----

  /**
   * URLs to open in Google Maps. Returns an empty array if there aren't
   * enough stops (need >=2). Long trips split into multiple URLs because
   * Google Maps' web URL API caps at 11 stops per directions link.
   *
   * Each stop's URL component prefers the place's saved Google Maps query
   * preference (Place.googleMapsQueryKey, set via the place-detail popover)
   * over raw lat,lng. When unset or no longer resolvable, falls back to
   * coords. This lets the user pick what works best per place — e.g. a
   * named business that Google indexes well, vs. a private residence
   * where coords are more accurate.
   */
  protected googleMapsUrls = computed<string[]>(() => {
    const t = this.facade.trip();
    if (!t || t.stops.length < 2) return [];
    const items = this.facade.stopsWithPlace();
    const stops: GoogleMapsStop[] = [];
    for (const { place } of items) {
      if (!place) continue; // skip stops whose place was deleted
      stops.push({
        lat: place.lat,
        lng: place.lng,
        query: preferredMapsQuery(place),
      });
    }
    if (stops.length < 2) return [];
    return splitForGoogleMaps(stops)
      .map((chunk) => buildGoogleMapsUrl(chunk, t.defaultTravelMode))
      .filter((u): u is string => u !== null);
  });

  protected exportTooLong = computed(
    () => (this.facade.trip()?.stops.length ?? 0) > GOOGLE_MAPS_MAX_STOPS
  );

  // ---- Leaflet ----

  private map: L.Map | null = null;
  private stopMarkers: L.Marker[] = [];
  private polyline: L.Polyline | null = null;

  /**
   * Ghost-pin marker shown when an undo is pending. Re-rendered whenever
   * facade.pendingUndoStop changes (added on remove, removed on undo or
   * timeout). Visually distinct from a regular stop pin: dashed outline,
   * partial opacity, no number badge — reads as "this used to be here."
   */
  private ghostMarker: L.Marker | null = null;

  // ---- Lifecycle ----

  constructor() {
    // Step 1: tell the facade which trip id we want. The facade exposes
    // `trip` as a computed off the store, so it'll resolve reactively
    // once the store finishes its initial load.
    effect(() => {
      this.facade.load(this.id());
    });

    // Step 2: populate the name / notes drafts when the trip first
    // resolves, exactly once per trip id (not on every subsequent update
    // — otherwise autosave would clobber the user's in-progress edits).
    let initializedForId: string | null = null;
    effect(() => {
      const id = this.id();
      const trip = this.facade.trip();
      if (!trip) return;
      if (initializedForId === id) return;
      initializedForId = id;
      this.nameDraft.set(trip.name);
      this.notesDraft.set(trip.notes ?? '');
    });

    // Step 3: initialize the Leaflet map as soon as the #mapEl div enters
    // the DOM (after facade.loaded() is true and the @else branch renders).
    effect(() => {
      const el = this.mapElRef();
      if (!el || this.map) return;
      this.initMap(el.nativeElement);
    });

    // Step 4: rebuild stop markers + polyline whenever stops change.
    effect(() => {
      // Track stops; mode changes don't need a re-sync (polyline color
      // and shape are stop-driven).
      this.facade.stopsWithPlace();
      if (this.map) {
        this.syncStopMarkers();
        this.syncPolyline();
      }
    });

    // Step 5: sync the ghost-pin marker when the undo state changes.
    // When a stop is removed, facade.pendingUndoStop becomes non-null and
    // we drop a dashed/translucent marker at the stop's old coords. On
    // undo or auto-dismiss the signal becomes null again and we remove
    // the marker.
    effect(() => {
      const stash = this.facade.pendingUndoStop();
      if (!this.map) return;
      this.syncGhostMarker(stash?.lat ?? null, stash?.lng ?? null);
    });
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.stopMarkers = [];
    this.polyline = null;
    this.ghostMarker = null;
  }

  // ---- Map ----

  private initMap(el: HTMLDivElement): void {
    const map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
    }).setView([17.385, 78.4867], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    this.map = map;

    this.syncStopMarkers();
    this.syncPolyline();
    this.fitToStops();

    // See bugfix notes: defer invalidateSize for CSS-grid layout settling.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.map) this.map.invalidateSize();
      });
    });
  }

  private syncStopMarkers(): void {
    if (!this.map) return;
    for (const m of this.stopMarkers) m.remove();
    this.stopMarkers = [];

    const items = this.facade.stopsWithPlace();
    items.forEach(({ stop, place }, idx) => {
      if (!place) return;
      const marker = L.marker([place.lat, place.lng], {
        icon: this.buildNumberedIcon(idx + 1, idx, items.length),
        zIndexOffset: 1000,
      }).addTo(this.map!);
      // Phase 6d: pin click opens the place detail panel (Phase 6c removed
      // the place from the trip — destructive-on-click is footgun UX).
      // Removal happens only via the stop card's trash button now, with
      // an undo toast + ghost-pin window for 30s.
      marker.on('click', () => {
        this.placeDetail?.open(stop.placeId);
      });
      marker.bindTooltip(`${idx + 1}. ${place.customName ?? place.name}`, {
        direction: 'top',
        offset: [0, -28],
      });
      this.stopMarkers.push(marker);
    });
  }

  private syncPolyline(): void {
    if (!this.map) return;
    if (this.polyline) {
      this.polyline.remove();
      this.polyline = null;
    }
    const coords = this.facade.stopCoordinates();
    if (coords.length < 2) return;

    const points = bezierPolylinePoints(coords);
    this.polyline = L.polyline(points, {
      color: getCssVar('--wf-accent') || '#FF6B5B',
      weight: 3,
      opacity: 0.85,
      smoothFactor: 1,
      dashArray: '6 8',
    }).addTo(this.map);
  }

  private fitToStops(): void {
    if (!this.map) return;
    const coords = this.facade.stopCoordinates();
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords);
    this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
  }

  // ---- Icon builders ----

  /**
   * Numbered teardrop pin. Start (idx=0) and end (idx=last) get a subtle
   * ring around the badge to differentiate them — matches the mockup's
   * .start / .end styling.
   */
  private buildNumberedIcon(n: number, idx: number, total: number): L.DivIcon {
    const accent = getCssVar('--wf-accent') || '#FF6B5B';
    const bg = getCssVar('--wf-bg') || '#ffffff';
    const isEnd = idx === 0 || idx === total - 1;
    const ring = isEnd
      ? `<circle cx="16" cy="16" r="12" fill="none" stroke="${accent}" stroke-width="2" opacity="0.35"/>`
      : '';
    return L.divIcon({
      className: 'wf-trip-stop-icon',
      html: `
        <svg width="36" height="44" viewBox="-5 -5 42 50" xmlns="http://www.w3.org/2000/svg" overflow="visible">
          ${ring}
          <path d="M16 2 C8 2 2 8 2 16 C2 26 16 38 16 38 C16 38 30 26 30 16 C30 8 24 2 16 2 Z"
            fill="${accent}" stroke="${bg}" stroke-width="2"/>
          <circle cx="16" cy="16" r="9" fill="${bg}"/>
          <text x="16" y="20" text-anchor="middle"
            font-family="ui-sans-serif, system-ui, sans-serif"
            font-size="11" font-weight="700" fill="${accent}">${n}</text>
        </svg>`,
      iconSize: [36, 44],
      iconAnchor: [16, 40],
    });
  }

  /**
   * Ghost pin shown on the map at the location of a just-removed stop,
   * while the undo toast is still showing. Dashed outline + low opacity +
   * no number — reads as "this used to be a stop." Auto-removed when the
   * facade's pendingUndoStop becomes null (on undo OR timeout).
   */
  private buildGhostIcon(): L.DivIcon {
    const accent = getCssVar('--wf-accent') || '#FF6B5B';
    return L.divIcon({
      className: 'wf-trip-ghost-icon',
      html: `
        <svg width="36" height="44" viewBox="-5 -5 42 50" xmlns="http://www.w3.org/2000/svg" overflow="visible">
          <path d="M16 2 C8 2 2 8 2 16 C2 26 16 38 16 38 C16 38 30 26 30 16 C30 8 24 2 16 2 Z"
            fill="none" stroke="${accent}" stroke-width="2"
            stroke-dasharray="4 3" opacity="0.55"/>
          <circle cx="16" cy="16" r="3" fill="${accent}" opacity="0.55"/>
        </svg>`,
      iconSize: [36, 44],
      iconAnchor: [16, 40],
    });
  }

  /**
   * Add / remove / update the ghost-pin marker. Called from a signal effect
   * whenever the undo stash changes. No-op when the map isn't ready yet.
   */
  private syncGhostMarker(lat: number | null, lng: number | null): void {
    if (!this.map) return;

    // Remove any existing ghost
    if (this.ghostMarker) {
      this.ghostMarker.remove();
      this.ghostMarker = null;
    }

    // Add new one if we have coords
    if (lat !== null && lng !== null) {
      this.ghostMarker = L.marker([lat, lng], {
        icon: this.buildGhostIcon(),
        interactive: false,
        zIndexOffset: 500,
      }).addTo(this.map);
    }
  }

  // ---- Picker ----

  protected openPicker(): void {
    this.showPicker.set(true);
  }

  protected onPickerPicked(placeId: string): void {
    void this.facade.addStop(placeId);
    // Column stays open — user can rapid-fire add multiple stops.
  }

  protected onPickerCancelled(): void {
    this.showPicker.set(false);
  }

  /**
   * Picker's "+ Save a new place" affordance — opens the standard add-place
   * modal. On save, the new place is added as a stop and the modal closes
   * (the picker column itself stays open so the user can keep adding).
   */
  protected onPickerNewPlace(): void {
    this.showAddPlace.set(true);
  }

  protected onAddPlaceSaved(place: { id: string }): void {
    this.showAddPlace.set(false);
    void this.facade.addStop(place.id);
  }

  protected onAddPlaceCancelled(): void {
    this.showAddPlace.set(false);
  }

  // ---- Place detail panel (pin click opens it) ----

  protected onPlaceDetailClosed(): void {
    // No-op: the panel manages its own visibility. Hook kept for symmetry
    // with HomeComponent in case future telemetry/edit handling wants it.
  }

  /**
   * Place detail's "Edit place" button: navigate to the home map with
   * ?edit=:id so HomeComponent can mount the add-place modal in edit
   * mode. Same pattern used in /places list view.
   */
  protected onEditPlace(placeId: string): void {
    this.router.navigate(['/'], { queryParams: { edit: placeId } });
  }

  // ---- Metadata edits ----

  protected startEditingName(): void {
    const t = this.facade.trip();
    if (!t) return;
    this.nameDraft.set(t.name);
    this.editingName.set(true);
  }

  protected async commitName(): Promise<void> {
    const v = this.nameDraft().trim();
    if (v && v !== this.facade.trip()?.name) {
      await this.facade.setName(v);
    }
    this.editingName.set(false);
  }

  protected cancelEditingName(): void {
    this.editingName.set(false);
    this.nameDraft.set(this.facade.trip()?.name ?? '');
  }

  protected async onDateChange(value: string): Promise<void> {
    await this.facade.setPlannedDate(value || undefined);
  }

  protected async onTravelModeChange(value: TravelMode): Promise<void> {
    await this.facade.setTravelMode(value);
  }

  protected async commitNotes(): Promise<void> {
    const draft = this.notesDraft();
    const current = this.facade.trip()?.notes ?? '';
    if (draft !== current) {
      await this.facade.setNotes(draft);
    }
  }

  protected async onToggleCompleted(): Promise<void> {
    const current = this.facade.trip()?.isCompleted ?? false;
    await this.facade.setIsCompleted(!current);
  }

  // ---- Stop actions ----

  protected onRemoveStop(stopId: string): void {
    void this.facade.removeStop(stopId);
  }

  protected onUndoRemove(): void {
    void this.facade.undoRemoveStop();
  }

  protected onDismissUndo(): void {
    this.facade.dismissUndo();
  }

  protected onStopNoteChanged(event: { stopId: string; note: string }): void {
    void this.facade.setStopNote(event.stopId, event.note);
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousIndex === event.currentIndex) return;
    void this.facade.moveStop(event.previousIndex, event.currentIndex);
  }

  // ---- Google Maps export ----

  /**
   * Open the trip in Google Maps. For trips with ≤ 11 stops, that's one
   * tab. For longer trips, opens each chunk as a separate tab — the
   * disclaimer next to the button explains this.
   */
  protected openInGoogleMaps(): void {
    const urls = this.googleMapsUrls();
    if (urls.length === 0) return;
    // window.open is more reliable than location.assign for "open multiple
    // tabs" cases; browsers usually allow N opens if triggered from a
    // direct user click.
    for (const url of urls) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // ---- Delete ----

  protected onDeleteTrip(): void {
    this.showDeleteConfirm.set(true);
  }

  protected async onDeleteConfirmed(): Promise<void> {
    this.showDeleteConfirm.set(false);
    await this.facade.deleteTrip();
    this.router.navigate(['/trips']);
  }

  protected onDeleteCancelled(): void {
    this.showDeleteConfirm.set(false);
  }
}

/**
 * Read a CSS variable from :root. Returns the trimmed value or '' if unset.
 */
function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Per-segment quadratic Bezier arcs sampled into a polyline. Alternates
 * sides so the route doesn't bow uniformly in one direction.
 */
function bezierPolylinePoints(
  stops: Array<[number, number]>
): Array<[number, number]> {
  if (stops.length < 2) return stops;
  const SAMPLES = 24;
  const ARC_RATIO = 0.15;
  const out: Array<[number, number]> = [];
  out.push(stops[0]);

  for (let i = 0; i < stops.length - 1; i++) {
    const [aLat, aLng] = stops[i];
    const [bLat, bLng] = stops[i + 1];

    const midLat = (aLat + bLat) / 2;
    const midLng = (aLng + bLng) / 2;

    const dLat = bLat - aLat;
    const dLng = bLng - aLng;
    const len = Math.hypot(dLat, dLng);
    if (len < 1e-9) {
      out.push([bLat, bLng]);
      continue;
    }
    const perpLat = -dLng / len;
    const perpLng = dLat / len;
    const offset = len * ARC_RATIO * (i % 2 === 0 ? 1 : -1);

    const ctrlLat = midLat + perpLat * offset;
    const ctrlLng = midLng + perpLng * offset;

    for (let s = 1; s <= SAMPLES; s++) {
      const t = s / SAMPLES;
      const u = 1 - t;
      const lat = u * u * aLat + 2 * u * t * ctrlLat + t * t * bLat;
      const lng = u * u * aLng + 2 * u * t * ctrlLng + t * t * bLng;
      out.push([lat, lng]);
    }
  }

  return out;
}