import { Injectable, inject, signal, computed } from '@angular/core';
import { CollectionsStore } from '../../core/stores/collections.store';
import { PlacesStore } from '../../core/stores/places.store';
import type { Collection, CollectionCoverGradient, Place } from '../../core/models';

/**
 * Per-instance state for a single Collection detail view.
 *
 * Owns the editing flags (name, gradient picker, icon picker, delete confirm),
 * the active undo stash for "remove place from collection", and the mutation
 * helpers that talk to the stores.
 *
 * Provided at the component level (not root) so each navigation to
 * `/collections/:id` gets a fresh instance with no leftover undo state from
 * a previous collection.
 */
@Injectable()
export class CollectionEditFacade {
  private collections = inject(CollectionsStore);
  private places = inject(PlacesStore);

  /** The id this facade is bound to. Set via load(). */
  private currentId = signal<string | null>(null);

  /** The live collection entity — null while loading or after delete. */
  readonly collection = computed<Collection | null>(() => {
    const id = this.currentId();
    if (!id) return null;
    return this.collections.entities().find((c) => c.id === id) ?? null;
  });

  /** All places that currently include this collection's id. */
  readonly placesInCollection = computed<Place[]>(() => {
    const id = this.currentId();
    if (!id) return [];
    return this.places
      .entities()
      .filter((p) => p.collectionIds.includes(id))
      .sort((a, b) => (a.customName ?? a.name).localeCompare(b.customName ?? b.name));
  });

  /** Convenience — same as placesInCollection().length. */
  readonly placeCount = computed<number>(() => this.placesInCollection().length);

  // ----- Editing flags -----

  readonly editingName = signal(false);
  readonly editedName = signal('');

  readonly showGradientPicker = signal(false);
  readonly showIconPicker = signal(false);
  readonly showDeleteConfirm = signal(false);

  // ----- Undo stash -----

  /**
   * When the user removes a place from this collection, we stash enough info
   * to restore on undo. Null when no undo is pending.
   */
  readonly pendingUndo = signal<UndoStash | null>(null);
  private undoTimer: ReturnType<typeof setTimeout> | null = null;

  /** How long the undo toast stays before auto-dismissing. */
  private readonly UNDO_TIMEOUT_MS = 6000;

  /** Bind this facade to a specific collection. Called from the component on route change. */
  load(id: string): void {
    this.currentId.set(id);
    this.editingName.set(false);
    this.showGradientPicker.set(false);
    this.showIconPicker.set(false);
    this.showDeleteConfirm.set(false);
    this.clearUndoTimer();
    this.pendingUndo.set(null);
  }

  // ----- Name editing -----

  startEditName(): void {
    const c = this.collection();
    if (!c) return;
    this.editedName.set(c.name);
    this.editingName.set(true);
  }

  async commitNameEdit(): Promise<void> {
    const c = this.collection();
    const trimmed = this.editedName().trim();
    if (!c || !trimmed || trimmed === c.name) {
      this.editingName.set(false);
      return;
    }
    await this.collections.updatePartial(c.id, { name: trimmed });
    this.editingName.set(false);
  }

  cancelNameEdit(): void {
    this.editingName.set(false);
  }

  // ----- Gradient + icon -----

  async applyGradient(gradient: CollectionCoverGradient): Promise<void> {
    const c = this.collection();
    if (!c) return;
    await this.collections.updatePartial(c.id, { coverGradient: gradient });
    this.showGradientPicker.set(false);
  }

  async applyIcon(icon: string): Promise<void> {
    const c = this.collection();
    if (!c) return;
    await this.collections.updatePartial(c.id, { coverIcon: icon });
    this.showIconPicker.set(false);
  }

  // ----- Remove place from collection (with undo) -----

  /**
   * Remove a place from this collection. The place itself is not deleted —
   * just untagged. Sets up the undo stash + timer.
   *
   * If a previous undo is pending, it's committed (timer cleared, toast
   * dismissed) before stashing the new one — only one undo lives at a time.
   */
  async removePlace(place: Place): Promise<void> {
    const c = this.collection();
    if (!c) return;

    // Commit any prior undo before starting a new one
    this.clearUndoTimer();

    const newCollectionIds = place.collectionIds.filter((id) => id !== c.id);
    await this.places.updatePartial(place.id, { collectionIds: newCollectionIds });

    // Stash for undo
    this.pendingUndo.set({
      placeId: place.id,
      placeName: place.customName ?? place.name,
      collectionId: c.id,
      collectionName: c.name,
    });

    // Auto-dismiss after timeout
    this.undoTimer = setTimeout(() => {
      this.pendingUndo.set(null);
      this.undoTimer = null;
    }, this.UNDO_TIMEOUT_MS);
  }

  /**
   * Restore the most recently removed place's membership. No-op if no undo
   * is pending or if the place no longer exists (e.g. was hard-deleted).
   */
  async undoRemove(): Promise<void> {
    const stash = this.pendingUndo();
    if (!stash) return;

    this.clearUndoTimer();
    this.pendingUndo.set(null);

    const place = this.places.entities().find((p) => p.id === stash.placeId);
    if (!place) return; // place was deleted in the meantime; nothing to restore to

    if (place.collectionIds.includes(stash.collectionId)) return; // already restored somehow
    await this.places.updatePartial(place.id, {
      collectionIds: [...place.collectionIds, stash.collectionId],
    });
  }

  dismissUndo(): void {
    this.clearUndoTimer();
    this.pendingUndo.set(null);
  }

  private clearUndoTimer(): void {
    if (this.undoTimer) {
      clearTimeout(this.undoTimer);
      this.undoTimer = null;
    }
  }

  // ----- Soft delete the collection -----

  /**
   * Soft-delete this collection. Places that referenced it keep their
   * collectionIds entry as a dangling reference — that's an established
   * pattern in this codebase; filters silently skip unknown ids.
   *
   * Returns true on success so the caller can navigate away.
   */
  async deleteCollection(): Promise<boolean> {
    const c = this.collection();
    if (!c) return false;
    await this.collections.softDelete(c.id);
    this.currentId.set(null);
    return true;
  }
}

/** Snapshot stored when a place is removed, used to restore on undo. */
export interface UndoStash {
  placeId: string;
  placeName: string;
  collectionId: string;
  collectionName: string;
}