import { Injectable, inject, signal, computed } from '@angular/core';
import { PlacesStore } from '../../../core/stores/places.store';
import { IdService } from '../../../core/services/id.service';
import {
  placeMapsQueryVariants,
  buildPlaceMapsUrl,
} from '../../../core/utils/place-maps-query';
import type { Place, PlaceStatus, Visit, VisitRating } from '../../../core/models';

/**
 * One option in the "Open in Google Maps" dropdown. The first variant in the
 * list is the smart default that the primary button click uses.
 *
 * This is the facade-local presentation shape: it adds `preview` (what the
 * user sees) and `url` (pre-built href) on top of the pure-data variant
 * coming from `core/utils/place-maps-query`. Kept separate so the template
 * doesn't need to know about URL building.
 */
export interface MapsQueryVariant {
  key: string;
  label: string;
  preview: string;
  url: string;
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
   * order. The first entry is the smart default; subsequent entries are
   * surfaced via the split-button popover for one-time override OR
   * save-as-default selection.
   *
   * Derivation logic (which variants exist, how they're labelled, and the
   * promotion of a saved-default variant to position 0) lives in
   * `core/utils/place-maps-query.ts` — shared between this screen and the
   * trip planner so they stay consistent.
   *
   * This computed wraps the util's pure-data variants with presentation
   * fields (`preview` = the query string itself, displayed under the
   * label; `url` = pre-built href).
   */
  readonly mapsQueryVariants = computed<MapsQueryVariant[]>(() => {
    const p = this.place();
    if (!p) return [];
    return placeMapsQueryVariants(p).map((v) => ({
      key: v.key,
      label: v.label,
      preview: v.query,
      url: buildPlaceMapsUrl(v.query),
    }));
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

  /**
   * Persist the user's preferred Google Maps query variant for this place.
   * Called from the popover when the user clicks a variant with the
   * "Set as default" checkbox ticked. The variant's key (not URL) is
   * stored so future changes to URL building don't invalidate preferences.
   */
  async saveMapsQueryKey(key: string): Promise<void> {
    const p = this.place();
    if (!p) return;
    if (p.googleMapsQueryKey === key) return; // no-op
    await this.placesStore.updatePartial(p.id, { googleMapsQueryKey: key });
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