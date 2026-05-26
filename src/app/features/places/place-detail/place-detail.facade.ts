import { Injectable, inject, signal, computed } from '@angular/core';
import { PlacesStore } from '../../../core/stores/places.store';
import { IdService } from '../../../core/services/id.service';
import type { Place, PlaceStatus, Visit, VisitRating } from '../../../core/models';

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
   * Smart Google Maps URL builder.
   *
   * Priority:
   *   1. customName + displayAddress  → "Custom Name, Full Address"
   *   2. displayAddress only          → full Nominatim address
   *   3. name + coords                → "POI Name @ lat,lng"
   *   4. coords only                  → bare lat,lng
   *
   * Uses Google Maps' /maps/search/?api=1&query=... format which accepts
   * free-form text, addresses, place names, or coordinates. Falls back
   * gracefully to coords for places that have nothing else.
   */
  readonly googleMapsUrl = computed<string>(() => {
    const p = this.place();
    if (!p) return '';

    const customName = p.customName?.trim();
    const displayAddress = p.displayAddress?.trim();
    const name = p.name?.trim();
    const coords = `${p.lat},${p.lng}`;

    let query: string;
    if (customName && displayAddress) {
      query = `${customName}, ${displayAddress}`;
    } else if (displayAddress) {
      query = displayAddress;
    } else if (name) {
      query = `${name} ${coords}`;
    } else {
      query = coords;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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