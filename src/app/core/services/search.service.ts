import { Injectable, inject } from '@angular/core';
import { computed } from '@angular/core';
import { PlacesStore } from '../stores/places.store';
import { CategoriesStore } from '../stores/categories.store';
import { VibeTagsStore } from '../stores/vibe-tags.store';
import { CollectionsStore } from '../stores/collections.store';
import type { Place, Collection, Trip } from '../models';
import { TripsStore } from '../stores/trips.store';

// ---- Result types (discriminated union) ----

export interface PlaceResult {
  type: 'place';
  place: Place;
  score: number;
  matchFields: string[];
  snippet: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}
 
export interface CollectionResult {
  type: 'collection';
  collection: Collection;
  score: number;
  snippet: string;
  /** Place count inside this collection. */
  placeCount: number;
}
 
export interface TripResult {
  type: 'trip';
  trip: Trip;
  score: number;
  snippet: string;
  /** Stop count. */
  stopCount: number;
}

export type SearchResult = PlaceResult | CollectionResult | TripResult;
 
export interface GroupedSearchResults {
  places: PlaceResult[];
  collections: CollectionResult[];
  trips: TripResult[];
  total: number;
}
 
/**
 * Lightweight fuzzy search across saved places, collections, and trips.
 *
 * Returns results grouped by entity type, each group sorted by score desc.
 * No external library — pure in-memory scan, fine for local dataset sizes.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private places = inject(PlacesStore);
  private categories = inject(CategoriesStore);
  private vibeTags = inject(VibeTagsStore);
  private collections = inject(CollectionsStore);
  private trips = inject(TripsStore);

  search(raw: string, limit = 10): GroupedSearchResults {
    const query = raw.trim().toLowerCase();
    if (!query) return { places: [], collections: [], trips: [], total: 0 };
 
    const catById = new Map(this.categories.entities().map((c) => [c.id, c]));
    const vibeById = new Map(this.vibeTags.entities().map((v) => [v.id, v]));
    const colById = new Map(this.collections.entities().map((c) => [c.id, c]));
 
    // Places — count per collection for CollectionResult
    const placesAll = this.places.entities();
    const placeCountByCol = new Map<string, number>();
    for (const p of placesAll) {
      for (const cid of p.collectionIds ?? []) {
        placeCountByCol.set(cid, (placeCountByCol.get(cid) ?? 0) + 1);
      }
    }
 
    // --- Score places ---
    const placeResults: PlaceResult[] = [];
    for (const place of placesAll) {
      const r = scorePlaceResult(place, query, catById, vibeById, colById);
      if (r) placeResults.push(r);
    }
 
    // --- Score collections ---
    const collectionResults: CollectionResult[] = [];
    for (const col of this.collections.entities()) {
      const r = scoreCollectionResult(col, query, placeCountByCol);
      if (r) collectionResults.push(r);
    }
 
    // --- Score trips ---
    const tripResults: TripResult[] = [];
    for (const trip of this.trips.entities()) {
      const r = scoreTripResult(trip, query);
      if (r) tripResults.push(r);
    }
 
    const places = placeResults.sort((a, b) => b.score - a.score).slice(0, limit);
    const collections = collectionResults.sort((a, b) => b.score - a.score).slice(0, limit);
    const trips = tripResults.sort((a, b) => b.score - a.score).slice(0, limit);
 
    return {
      places,
      collections,
      trips,
      total: places.length + collections.length + trips.length,
    };
  }
}
 
// ---- Pure scoring helpers ----
 
function scorePlaceResult(
  place: Place,
  query: string,
  catById: Map<string, { name: string; color: string; icon: string }>,
  vibeById: Map<string, { name: string }>,
  colById: Map<string, { name: string }>
): PlaceResult | null {
  const cat = catById.get(place.categoryId);
  const vibeNames = (place.vibeTagIds ?? []).map((id) => vibeById.get(id)?.name ?? '').filter(Boolean);
  const colNames = (place.collectionIds ?? []).map((id) => colById.get(id)?.name ?? '').filter(Boolean);
 
  const displayName = (place.customName ?? place.name).toLowerCase();
  const rawName = place.name.toLowerCase();
  const address = (place.displayAddress ?? '').toLowerCase();
  const locality = (place.locality ?? '').toLowerCase();
  const region = (place.region ?? '').toLowerCase();
  const country = (place.country ?? '').toLowerCase();
  const notes = (place.customNotes ?? '').toLowerCase();
  const review = (place.reviewText ?? '').toLowerCase();
  const catName = (cat?.name ?? '').toLowerCase();
 
  let score = 0;
  const matchFields: string[] = [];
  let snippet = place.customName ?? place.name;
 
  if (displayName === query || rawName === query) {
    score = Math.max(score, 100); matchFields.push('name');
  } else if (displayName.startsWith(query) || rawName.startsWith(query)) {
    score = Math.max(score, 80); matchFields.push('name');
  } else if (displayName.includes(query) || rawName.includes(query)) {
    score = Math.max(score, 60); matchFields.push('name');
  } else if (fuzzyMatch(query, displayName) || fuzzyMatch(query, rawName)) {
    score = Math.max(score, 40); matchFields.push('name');
  }
 
  for (const t of [address, locality, region, country]) {
    if (!t) continue;
    if (t.includes(query)) {
      score = Math.max(score, 40); matchFields.push('address');
      if (!matchFields.includes('name')) snippet = place.displayAddress ?? place.locality ?? snippet;
      break;
    } else if (fuzzyMatch(query, t)) {
      score = Math.max(score, 25); matchFields.push('address'); break;
    }
  }
 
  for (const t of [notes, review]) {
    if (!t) continue;
    if (t.includes(query)) { score = Math.max(score, 30); matchFields.push('notes'); break; }
    else if (fuzzyMatch(query, t)) { score = Math.max(score, 15); matchFields.push('notes'); break; }
  }
 
  if (catName.includes(query) || fuzzyMatch(query, catName)) {
    score = Math.max(score, 20); matchFields.push('category');
  }
  for (const v of vibeNames) {
    const vl = v.toLowerCase();
    if (vl.includes(query) || fuzzyMatch(query, vl)) { score = Math.max(score, 20); matchFields.push('vibe'); break; }
  }
  for (const c of colNames) {
    const cl = c.toLowerCase();
    if (cl.includes(query) || fuzzyMatch(query, cl)) { score = Math.max(score, 20); matchFields.push('collection'); break; }
  }

  if (score === 0) return null;
 
  return {
    type: 'place',
    place,
    score,
    matchFields: [...new Set(matchFields)],
    snippet: snippet || place.name,
    categoryName: cat?.name ?? '',
    categoryColor: cat?.color ?? '#ccc',
    categoryIcon: cat?.icon ?? 'circle',
  };
}
 
function scoreCollectionResult(
  col: Collection,
  query: string,
  placeCountByCol: Map<string, number>
): CollectionResult | null {
  const name = col.name.toLowerCase();
  let score = 0;
 
  if (name === query) score = 100;
  else if (name.startsWith(query)) score = 80;
  else if (name.includes(query)) score = 60;
  else if (fuzzyMatch(query, name)) score = 40;
 
  if (score === 0) return null;

  return {
    type: 'collection',
    collection: col,
    score,
    snippet: col.name,
    placeCount: placeCountByCol.get(col.id) ?? 0,
  };
}
 
function scoreTripResult(trip: Trip, query: string): TripResult | null {
  const name = trip.name.toLowerCase();
  const notes = (trip.notes ?? '').toLowerCase();
  let score = 0;
  let snippet = trip.name;
 
  if (name === query) score = 100;
  else if (name.startsWith(query)) score = 80;
  else if (name.includes(query)) score = 60;
  else if (fuzzyMatch(query, name)) score = 40;
 
  if (score === 0 && notes) {
    if (notes.includes(query)) { score = 30; snippet = truncateSnippet(trip.notes ?? '', query); }
    else if (fuzzyMatch(query, notes)) { score = 15; snippet = truncateSnippet(trip.notes ?? '', query); }
  }
 
  if (score === 0) return null;
 
  return {
    type: 'trip',
    trip,
    score,
    snippet,
    stopCount: trip.stops.length,
  };
}
 
function truncateSnippet(text: string, query: string, radius = 40): string {
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function fuzzyMatch(needle: string, haystack: string): boolean {
  if (!needle || !haystack) return false;
  if (needle.length < 3) return haystack.includes(needle);
  let hi = 0;
  for (let ni = 0; ni < needle.length; ni++) {
    let found = false;
    while (hi < haystack.length) {
      if (haystack[hi] === needle[ni]) { hi++; found = true; break; }
      hi++;
    }
    if (!found) return false;
  }
  return needle.length / haystack.length >= 0.15;
}
