import { Injectable, inject, signal, computed } from '@angular/core';
import { PlacesStore } from '../../../core/stores/places.store';
import { CollectionsStore } from '../../../core/stores/collections.store';
import { CategoriesStore } from '../../../core/stores/categories.store';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { GoogleMapsLinkService } from '../../../core/services/google-maps-link.service';
import { IdService } from '../../../core/services/id.service';
import type { Place, PlaceStatus } from '../../../core/models';

export type AddStep = 1 | 2 | 3 | 4;

export interface DraftPlace {
  name: string;
  lat: number;
  lng: number;
  locality: string;
  region: string;
  country: string;
  sourceUrl?: string;
}

/**
 * Per-flow orchestrator service. NOT providedIn: 'root' — instantiated
 * fresh for each AddPlaceComponent. Holds the modal's transient state
 * (draft, current step, selections) and coordinates the geocoding +
 * persistence calls.
 *
 * Host components inject this; sub-step components inject the same instance
 * (because AddPlaceComponent provides it).
 */
@Injectable()
export class AddPlaceFacade {
  private placesStore = inject(PlacesStore);
  private collectionsStore = inject(CollectionsStore);
  private categoriesStore = inject(CategoriesStore);
  private geocoding = inject(GeocodingService);
  private mapsLink = inject(GoogleMapsLinkService);
  private idService = inject(IdService);

  // ----- state -----
  readonly step = signal<AddStep>(1);
  readonly inputText = signal<string>('');
  readonly draft = signal<DraftPlace | null>(null);
  readonly categoryId = signal<string | null>(null);
  readonly vibeTagIds = signal<string[]>([]);
  readonly collectionIds = signal<string[]>([]);
  readonly status = signal<PlaceStatus>('planned');
  readonly isFavorite = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // ----- computed validators -----
  readonly canContinueStep1 = computed(() => this.inputText().trim().length > 0);
  readonly canContinueStep2 = computed(() => this.draft() !== null);
  readonly canContinueStep3 = computed(() => this.categoryId() !== null);

  // ----- actions -----
  async resolveInput(): Promise<void> {
    const raw = this.inputText().trim();
    if (!raw) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      const parsed = this.mapsLink.parse(raw);

      if (parsed.needsExpansion) {
        this.error.set(
          'Short Google Maps links need server expansion (not in v1). Paste the full URL or an address.'
        );
        return;
      }

      // We have explicit coordinates from a parsed URL
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        const reverse = await this.geocoding.reverse(parsed.lat, parsed.lng);
        this.draft.set({
          name: parsed.name ?? reverse?.name ?? `${parsed.lat}, ${parsed.lng}`,
          lat: parsed.lat,
          lng: parsed.lng,
          locality: reverse?.locality ?? '',
          region: reverse?.region ?? '',
          country: reverse?.country ?? '',
          sourceUrl: parsed.raw,
        });
        this.step.set(2);
        return;
      }

      // Treat as freeform address — try forward geocode
      let results = await this.geocoding.forward(raw);

      // Fallback: if first attempt returned nothing AND query has commas,
      // try again with commas stripped. Helps with informal input like
      // "kfc, lb nagar" where Nominatim's structured parser fails.
      if (results.length === 0 && raw.includes(',')) {
        const noCommas = raw.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        results = await this.geocoding.forward(noCommas);
      }

      if (results.length === 0) {
        this.error.set(
          "Couldn't find that. Try a fuller address, or close this and click on the map directly."
        );
        return;
      }

      // Take the top result; multi-candidate picker is a v1.1 enhancement
      const r = results[0];
      this.draft.set({
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        locality: r.locality,
        region: r.region,
        country: r.country,
      });
      this.step.set(2);
    } catch {
      this.error.set('Network problem. Check your connection or click the map directly.');
    } finally {
      this.loading.set(false);
    }
  }


  /**
   * Used when the user closes the modal and clicks the map manually.
   */
  async setDraftFromMapClick(lat: number, lng: number, name?: string): Promise<void> {
    this.loading.set(true);
    try {
      const r = await this.geocoding.reverse(lat, lng);
      this.draft.set({
        name: name ?? r?.name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng,
        locality: r?.locality ?? '',
        region: r?.region ?? '',
        country: r?.country ?? '',
      });
      this.step.set(2);
    } catch {
      // Even if reverse geocode fails, we still have coords — let user proceed
      this.draft.set({
        name: name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        lat,
        lng,
        locality: '',
        region: '',
        country: '',
      });
      this.step.set(2);
    } finally {
      this.loading.set(false);
    }
  }

  goNext(): void {
    this.step.update((s) => Math.min(4, s + 1) as AddStep);
  }

  goBack(): void {
    this.step.update((s) => Math.max(1, s - 1) as AddStep);
  }

  toggleVibeTag(id: string): void {
    this.vibeTagIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  toggleCollection(id: string): void {
    this.collectionIds.update((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
    );
  }

  
async save(): Promise<Place | null> {
    const draft = this.draft();
    const categoryId = this.categoryId();
    if (!draft || !categoryId) return null;

    const now = new Date().toISOString();
    const place: Place = {
      id: this.idService.newId(),
      name: draft.name,
      lat: draft.lat,
      lng: draft.lng,
      locality: draft.locality,
      region: draft.region,
      country: draft.country,
      categoryId,
      vibeTagIds: this.vibeTagIds(),
      collectionIds: this.collectionIds(),
      status: this.status(),
      isFavorite: this.isFavorite(),
      visits: [],
      sourceUrl: draft.sourceUrl,
      createdAt: now,
      updatedAt: now,
    };

    await this.placesStore.add(place);
    return place;
  }

  reset(): void {
    this.step.set(1);
    this.inputText.set('');
    this.draft.set(null);
    this.categoryId.set(null);
    this.vibeTagIds.set([]);
    this.collectionIds.set([]);
    this.status.set('planned');
    this.isFavorite.set(false);
    this.error.set(null);
    this.loading.set(false);
  }
}