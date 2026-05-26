import { Injectable, inject, signal, computed } from '@angular/core';
import { PlacesStore } from '../../../core/stores/places.store';
import { IdService } from '../../../core/services/id.service';
import type { Place, PlaceStatus, Visit, VisitRating } from '../../../core/models';

/**
 * One option in the "Open in Google Maps" dropdown. The first variant in the
 * list is the smart default that the primary button click uses.
 */
export interface MapsQueryVariant {
  /** Stable identifier — used for tracking and *ngFor track-by. */
  key: string;
  /** Human-readable label shown in the dropdown row. */
  label: string;
  /** What the actual query string looks like (shown as a preview). */
  preview: string;
  /** Pre-built Google Maps URL ready to drop into an <a href>. */
  url: string;
}

/**
 * Builds a Google Maps search URL from a free-form query string.
 * Uses the /maps/search/?api=1&query=... format which accepts addresses,
 * place names, coordinates, or any combination.
 */
function buildMapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

@Injectable()
export class PlaceDetailFacade {
  private placesStore = inject(PlacesStore);
  private idService = inject(IdService);

  readonly placeId = signal<string | null>(null);
  readonly editingName = signal(false);
  readonly editedName = signal('');
  readonly addingVisit = signal(false);

  // Visit draft state — bound to the "add visit" form
  readonly visitDraftRating = signal<VisitRating | null>(null);
  readonly visitDraftNote = signal('');
  readonly visitDraftDate = signal<string>(this.todayISO());

  /** The active place, looked up live from the store. Returns null if not found. */
  readonly place = computed<Place | null>(() => {
    const id = this.placeId();
    if (!id) return null;
    return this.placesStore.entities().find((p) => p.id === id) ?? null;
  });

  /** Displayed name — custom if set, otherwise Nominatim's. */
  readonly displayName = computed<string>(() => {
    const p = this.place();
    return p?.customName ?? p?.name ?? '';
  });

  /** Visits sorted newest first. */
  readonly sortedVisits = computed<Visit[]>(() => {
    const p = this.place();
    if (!p) return [];
    return [...p.visits].sort((a, b) => b.date.localeCompare(a.date));
  });

  /**
   * Available Google Maps query variants for the current place, in priority
   * order. The first entry is the smart default; the rest are user overrides
   * surfaced via the split-button dropdown in place-detail.
   *
   * Why a list and not a single computed URL: addresses like "Mantri Cosmos,
   * ISB Road, Gachibowli" used to fall through to "address only", which sent
   * Maps to the street instead of the apartment. We now combine name +
   * address by default. The user can still pick a narrower or broader query
   * if Google indexes the place differently than Nominatim does.
   *
   * Each variant has a stable key (for tracking), a human label, a preview
   * (what the query actually looks like), and the final maps URL.
   */
  readonly mapsQueryVariants = computed<MapsQueryVariant[]>(() => {
    const p = this.place();
    if (!p) return [];

    const customName = p.customName?.trim();
    const displayAddress = p.displayAddress?.trim();
    const name = p.name?.trim();
    const locality = [p.locality, p.region].filter(Boolean).join(', ');
    const coords = `${p.lat},${p.lng}`;

    const variants: MapsQueryVariant[] = [];

    // Tier 1: customName + displayAddress (user-named, fully addressed)
    if (customName && displayAddress) {
      variants.push({
        key: 'custom-name-and-address',
        label: 'Custom name + address',
        preview: `${customName}, ${displayAddress}`,
        url: buildMapsUrl(`${customName}, ${displayAddress}`),
      });
    }

    // Tier 2: name + displayAddress (NEW — the Mantri Cosmos fix)
    if (name && displayAddress) {
      variants.push({
        key: 'name-and-address',
        label: 'Name + address',
        preview: `${name}, ${displayAddress}`,
        url: buildMapsUrl(`${name}, ${displayAddress}`),
      });
    }

    // Tier 3: customName + locality (broader than full address)
    if (customName && locality) {
      variants.push({
        key: 'custom-name-and-locality',
        label: 'Custom name + city',
        preview: `${customName}, ${locality}`,
        url: buildMapsUrl(`${customName}, ${locality}`),
      });
    }

    // Tier 4: displayAddress only
    if (displayAddress) {
      variants.push({
        key: 'address-only',
        label: 'Address only',
        preview: displayAddress,
        url: buildMapsUrl(displayAddress),
      });
    }

    // Tier 5: name only
    if (name) {
      variants.push({
        key: 'name-only',
        label: 'Place name only',
        preview: name,
        url: buildMapsUrl(name),
      });
    }

    // Tier 6: coordinates — always available as a last-resort
    variants.push({
      key: 'coords',
      label: 'Coordinates',
      preview: coords,
      url: buildMapsUrl(coords),
    });

    return variants;
  });

  /**
   * The smart default — just the first variant. Used by the split button's
   * primary click action. Empty string when no place is loaded.
   */
  readonly googleMapsUrl = computed<string>(() => {
    return this.mapsQueryVariants()[0]?.url ?? '';
  });

  // ----- actions -----

  open(placeId: string): void {
    this.placeId.set(placeId);
    this.editingName.set(false);
    this.addingVisit.set(false);
    this.resetVisitDraft();
  }

  close(): void {
    this.placeId.set(null);
    this.editingName.set(false);
    this.addingVisit.set(false);
    this.resetVisitDraft();
  }

  startEditName(): void {
    this.editedName.set(this.displayName());
    this.editingName.set(true);
  }

  async saveEditedName(): Promise<void> {
    const p = this.place();
    if (!p) return;
    const newName = this.editedName().trim();
    if (!newName) return;
    const customName = newName === p.name ? undefined : newName;
    await this.placesStore.updatePartial(p.id, { customName });
    this.editingName.set(false);
  }

  cancelEditName(): void {
    this.editingName.set(false);
  }

  async toggleStatus(): Promise<void> {
    const p = this.place();
    if (!p) return;
    const next: PlaceStatus = p.status === 'planned' ? 'visited' : 'planned';
    await this.placesStore.updatePartial(p.id, { status: next });
  }

  async toggleFavorite(): Promise<void> {
    const p = this.place();
    if (!p) return;
    await this.placesStore.updatePartial(p.id, { isFavorite: !p.isFavorite });
  }

  startAddVisit(): void {
    this.resetVisitDraft();
    this.addingVisit.set(true);
  }

  cancelAddVisit(): void {
    this.addingVisit.set(false);
    this.resetVisitDraft();
  }

  setVisitRating(rating: VisitRating): void {
    this.visitDraftRating.set(rating);
  }

  async saveVisit(): Promise<void> {
    const p = this.place();
    const rating = this.visitDraftRating();
    if (!p || !rating) return;

    const visit: Visit = {
      id: this.idService.newId(),
      date: this.visitDraftDate(),
      rating,
      note: this.visitDraftNote().trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    await this.placesStore.updatePartial(p.id, {
      visits: [...p.visits, visit],
      // First visit auto-flips status to visited
      status: p.status === 'planned' ? 'visited' : p.status,
    });

    this.addingVisit.set(false);
    this.resetVisitDraft();
  }

  async deleteVisit(visitId: string): Promise<void> {
    const p = this.place();
    if (!p) return;
    await this.placesStore.updatePartial(p.id, {
      visits: p.visits.filter((v) => v.id !== visitId),
    });
  }

  /** Permanently delete the place (soft-delete via deletedAt). */
  async deletePlace(): Promise<void> {
    const p = this.place();
    if (!p) return;
    await this.placesStore.softDelete(p.id);
    this.close();
  }

  /**
   * Commits any unsaved name edit. Called when the user clicks outside the
   * panel — matches typical "blur to confirm" UX so the edit isn't lost.
   */
  async commitPendingEdits(): Promise<void> {
    if (this.editingName()) {
      await this.saveEditedName();
    }
  }

  private resetVisitDraft(): void {
    this.visitDraftRating.set(null);
    this.visitDraftNote.set('');
    this.visitDraftDate.set(this.todayISO());
  }

  private todayISO(): string {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
}