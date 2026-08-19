import {
  Component, input, output, effect, inject, signal,
  ElementRef, ViewChild, AfterViewInit, OnDestroy, ChangeDetectionStrategy,
} from '@angular/core';
import { LEAFLET } from '../../core/tokens/leaflet.token';
import { CategoriesStore } from '../../core/stores/categories.store';
import type * as LeafletTypes from 'leaflet';
import type { Place } from '../../core/models';
 
/**
 * A small self-contained Leaflet map that shows exactly the places Scout
 * returned, auto-fitted to their bounds. Markers are colored by category.
 * Clicking a marker emits `select`, same as clicking a result card.
 *
 * Deliberately independent of the home map instance — Scout's results are a
 * transient view, and coupling to the home map's lifecycle/filters would be
 * fragile. This map is created fresh from the places input each time.
 */
@Component({
  selector: 'wf-scout-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #mapEl class="scout-map" [class.empty]="!places().length"></div>`,
  styles: [`
    .scout-map {
      width: 100%; height: 100%;
      border-radius: var(--wf-radius-card, 14px);
      overflow: hidden;
      background: var(--wf-map-land, var(--wf-bg-2));
    }
    .scout-map.empty { display: none; }
  `],
})
export class ScoutMapComponent implements AfterViewInit, OnDestroy {
  private L = inject(LEAFLET);
  private categories = inject(CategoriesStore);
 
  readonly places = input.required<Place[]>();
  readonly select = output<Place>();

  @ViewChild('mapEl', { static: true }) mapEl!: ElementRef<HTMLDivElement>;
 
  private map: LeafletTypes.Map | null = null;
  private markerLayer: LeafletTypes.LayerGroup | null = null;
  private ready = signal(false);
 
  constructor() {
    // Re-render markers whenever the places change AND the map exists.
    effect(() => {
      const list = this.places();
      if (this.ready() && this.map) {
        this.renderMarkers(list);
      }
    });
  }
 
  ngAfterViewInit(): void {
    // Guard against the SSR/build fallback where L is an empty object.
    if (!this.L || typeof (this.L as any).map !== 'function') return;

    this.map = this.L.map(this.mapEl.nativeElement, {
      zoomControl: false,
      attributionControl: false,
    }).setView([17.385, 78.4867], 11); // Hyderabad default; refit on markers
 
    this.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);
 
    this.markerLayer = this.L.layerGroup().addTo(this.map);
    this.ready.set(true);
    this.renderMarkers(this.places());
 
    // Leaflet needs a size recalc once the container has real dimensions.
    setTimeout(() => this.map?.invalidateSize(), 60);
  }
 
  ngOnDestroy(): void {
    this.map?.remove();
    this.map = null;
  }

  private renderMarkers(places: Place[]): void {
    if (!this.map || !this.markerLayer) return;
    this.markerLayer.clearLayers();
    if (!places.length) return;
 
    const bounds: [number, number][] = [];
    places.forEach((p, i) => {
      const color = this.colorFor(p);
      const marker = this.L.marker([p.lat, p.lng], {
        icon: this.pinIcon(color, i + 1),
      });
      marker.on('click', () => this.select.emit(p));
      marker.addTo(this.markerLayer!);
      bounds.push([p.lat, p.lng]);
    });
 
    if (bounds.length === 1) {
      this.map.setView(bounds[0], 14);
    } else {
      this.map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    }
    setTimeout(() => this.map?.invalidateSize(), 40);
  }

  private colorFor(p: Place): string {
    const cat = this.categories.entities().find((c) => c.id === p.categoryId);
    return cat?.color ?? '#ff6b5b';
  }
 
  private pinIcon(color: string, order: number): LeafletTypes.DivIcon {
    // Simple numbered teardrop; matches the app's flat pin language without
    // pulling in the full pin-icons SVG set (kept lightweight on purpose).
    const html = `
      <div style="
        width:26px;height:26px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        background:${color};
        border:2px solid var(--wf-bg,#fff);
        box-shadow:0 2px 6px rgba(0,0,0,0.3);
        display:grid;place-items:center;">
        <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;
          font-family:monospace;">${order}</span>
      </div>`;
    return this.L.divIcon({
      html,
      className: 'scout-pin',
      iconSize: [26, 26],
      iconAnchor: [13, 26],
    });
  }
}
