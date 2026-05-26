import { Injectable, inject, signal, computed } from '@angular/core';
import { PlacesStore } from '../../../core/stores/places.store';
import { CollectionsStore } from '../../../core/stores/collections.store';
import { CategoriesStore } from '../../../core/stores/categories.store';
import { GeocodingService } from '../../../core/services/geocoding.service';
import { GoogleMapsLinkService } from '../../../core/services/google-maps-link.service';
import { IdService } from '../../../core/services/id.service';
import { parseCoordinates } from '../../../core/utils/coord-parser';
import type { Place, PlaceStatus } from '../../../core/models';

export type AddStep = 1 | 2 | 3 | 4;

export interface DraftPlace {
  name: string;              // POI name from geocoder (or fallback)
  customName: string;        // user-editable label (defaults to name)
  displayAddress: string;    // formatted address line for display
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
  readonly customName = signal<string>('');
  readonly categoryId = signal<string | null>(null);
  readonly vibeTagIds = signal<string[]>([]);
  readonly collectionIds = signal<string[]>([]);
  readonly status = signal<PlaceStatus>('planned');
  readonly isFavorite = signal<boolean>(false);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * When non-null, we are editing an existing place rather than creating one.
   * save() will call updatePartial instead of add.
   */
  readonly editingPlaceId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.editingPlaceId() !== null);

  // ----- computed validators -----
  readonly canContinueStep1 = computed(() => this.inputText().trim().length > 0);
  readonly canContinueStep2 = computed(() => this.draft() !== null && this.customName().trim().length > 0);
  readonly canContinueStep3 = computed(() => this.categoryId() !== null);

  // ----- edit mode entry point -----

  /**
   * Pre-populate the facade with an existing place's data and jump to step 2.
   * Skips step 1 (address resolution) since we already have the location.
   */
  enterEditMode(place: Place): void {
    this.editingPlaceId.set(place.id);
    this.draft.set({
      name: place.name,
      displayAddress: place.displayAddress ?? place.name,
      customName: place.customName ?? place.name,
      lat: place.lat,
      lng: place.lng,
      locality: place.locality,
      region: place.region,
      country: place.country,
      sourceUrl: place.sourceUrl,
    });
    this.customName.set(place.customName ?? place.name);
    this.categoryId.set(place.categoryId);
    this.vibeTagIds.set([...place.vibeTagIds]);
    this.collectionIds.set([...place.collectionIds]);
    this.status.set(place.status);
    this.isFavorite.set(place.isFavorite);
    this.step.set(2); // skip step 1
  }

  // ----- actions -----
  /**
   * Resolves the input text from step 1 into a draft place. Pattern-matches
   * input type in this priority order:
   *   1. Coordinates (with or without degree symbols / DMS)
   *   2. Short Google Maps link → educational help message
   *   3. Long Google Maps URL → extract coords, reverse geocode
   *   4. Plain text → forward geocode with comma-fallback
   */
  async resolveInput(): Promise<void> {
    const raw = this.inputText().trim();
    if (!raw) return;

    this.loading.set(true);
    this.error.set(null);

    try {
      // Case 1: coordinates (any format)
      const coords = parseCoordinates(raw);
      if (coords) {
        await this.resolveFromCoords(coords.lat, coords.lng, undefined, raw);
        return;
      }

      // Case 2 & 3: Google Maps URL
      const parsed = this.mapsLink.parse(raw);

      if (parsed.needsExpansion) {
        this.error.set(
          "Short Google Maps links can't be read directly in the browser. " +
            'To get the full link: open the link in Google Maps → tap the place name → ' +
            'tap Share → Copy link. Paste that here.'
        );
        return;
      }
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
        await this.resolveFromCoords(parsed.lat, parsed.lng, parsed.name, parsed.raw);
        return;
      }

      // Case 4: forward geocode plain text
      let query = raw;

      // NEW: handle Plus Code fragments better
      if (looksLikePlusCode(raw)) {
        // IMPORTANT: force better context formatting for OSM/Nominatim
        query = raw.split(',').slice(1).join(',')
      }

      let results = await this.geocoding.forward(query);

      // Comma-strip fallback (existing behaviour)
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

      const r = results[0];
      this.draft.set({
        name: r.name,
        customName: r.name, // default editable name
        displayAddress: r.displayAddress,
        lat: r.lat,
        lng: r.lng,
        locality: r.locality,
        region: r.region,
        country: r.country,
      });
      this.customName.set(r.name);
      this.step.set(2);
    } catch {
      this.error.set('Network problem. Check your connection or click the map directly.');
    } finally {
      this.loading.set(false);
    }
  }
  /**
   * Map click → skip step 1, jump straight to step 2 with reverse geocode.
   */
  async setDraftFromMapClick(lat: number, lng: number, name?: string): Promise<void> {
    this.loading.set(true);
    try {
      await this.resolveFromCoords(lat, lng, name);
    } catch {
      const fallback = name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      // Even if reverse geocode fails, we still have coords — let user proceed
      this.draft.set({
        name: fallback,
        customName: fallback,
        displayAddress: '',
        lat,
        lng,
        locality: '',
        region: '',
        country: '',
      });
      this.customName.set(this.draft()?.customName ?? '');
      this.step.set(2);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Shared helper: given lat/lng, reverse geocode and populate the draft.
   * Falls back to coordinate-string name if reverse geocode fails.
   */
  private async resolveFromCoords(
    lat: number,
    lng: number,
    presetName?: string,
    sourceUrl?: string
  ): Promise<void> {
    const reverse = await this.geocoding.reverse(lat, lng);
    const name =
      presetName ?? reverse?.name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const displayAddress = reverse?.displayAddress ?? '';

    this.draft.set({
      name,
      customName: name,
      displayAddress,
      lat,
      lng,
      locality: reverse?.locality ?? '',
      region: reverse?.region ?? '',
      country: reverse?.country ?? '',
      sourceUrl,
    });

    this.customName.set(name);
    this.step.set(2);
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

    const editedName = this.customName().trim();
    const customName =
      editedName && editedName !== draft.name ? editedName : undefined;
    const now = new Date().toISOString();

    if (this.isEditMode()) {
      // Edit mode — update the existing record
      const id = this.editingPlaceId()!;
      await this.placesStore.updatePartial(id, {
        customName,
        categoryId,
        vibeTagIds: this.vibeTagIds(),
        collectionIds: this.collectionIds(),
        status: this.status(),
        isFavorite: this.isFavorite(),
        updatedAt: now,
      });
      // Return the updated place so the caller can react
      return this.placesStore.getById(id) ?? null;
    }

    const place: Place = {
      id: this.idService.newId(),
      name: draft.name,
      displayAddress: draft.displayAddress || undefined,
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
      // Save custom name only if it differs from the default — keeps records clean
      customName,
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
    this.customName.set('');
    this.categoryId.set(null);
    this.vibeTagIds.set([]);
    this.collectionIds.set([]);
    this.status.set('planned');
    this.isFavorite.set(false);
    this.error.set(null);
    this.loading.set(false);
    this.editingPlaceId.set(null);
  }
}

function looksLikePlusCode(input: string): boolean {
  return /\b[A-Z0-9]{4,}\+[A-Z0-9]{2,}\b/i.test(input);
}