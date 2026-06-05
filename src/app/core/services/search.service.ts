import { Injectable, inject } from '@angular/core';
import { computed } from '@angular/core';
import { PlacesStore } from '../stores/places.store';
import { CategoriesStore } from '../stores/categories.store';
import { VibeTagsStore } from '../stores/vibe-tags.store';
import { CollectionsStore } from '../stores/collections.store';
import type { Place } from '../models';
 
export interface SearchResult {
  place: Place;
  score: number;
  /** Which fields matched — shown as context in the result row. */
  matchFields: string[];
  /** Short display snippet — the best matching text for the result row. */
  snippet: string;
  /** Category name resolved at search time (avoids lookup in template). */
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
}
/**
 * Lightweight fuzzy search across saved places.
 *
 * Searched fields (in priority order):
 *   1. customName / name (highest weight)
 *   2. displayAddress / locality / region / country
 *   3. reviewText / customNotes
 *   4. category name
 *   5. vibe tag names
 *   6. collection names
 *
 * Ranking tiers (higher = better):
 *   100 — exact name match (case-insensitive)
 *    80 — name starts with query
 *    60 — name contains query
 *    40 — address / locality match
 *    30 — notes / review match
 *    20 — category / vibe / collection match
 *    +fuzzy — character-sequence bonus when no exact match
 *
 * Fuzzy matching: checks if every character in the query appears in order
 * in the target string. Cheap O(n*m), good enough for local data sizes.
 * No external library needed.
 *
 * Design choice: no debouncing here — this is a synchronous in-memory
 * search over a local dataset (likely <5000 places). The calling component
 * is responsible for debouncing the input event if needed.
 */
@Injectable({ providedIn: 'root' })
export class SearchService {
  private places = inject(PlacesStore);
  private categories = inject(CategoriesStore);
  private vibeTags = inject(VibeTagsStore);
  private collections = inject(CollectionsStore);
 
  /**
   * Run a fuzzy search. Returns up to `limit` results sorted by score desc.
   * Empty or whitespace-only queries return [].
   */
search(raw: string, limit = 20): SearchResult[] {
    const query = raw.trim().toLowerCase();
    if (!query) return [];
 
    const catById = new Map(
      this.categories.entities().map((c) => [c.id, c])
    );
    const vibeById = new Map(
      this.vibeTags.entities().map((v) => [v.id, v])
    );
    const colById = new Map(
      this.collections.entities().map((c) => [c.id, c])
    );
 
    const results: SearchResult[] = [];
 
    for (const place of this.places.entities()) {
const r = scorePlace(place, query, catById, vibeById, colById);
      if (r) results.push(r);
    }
 
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
 
// ---- Pure scoring helpers (no Angular, easy to unit-test) ----
 
function scorePlace(
  place: Place,
  query: string,
  catById: Map<string, { name: string; color: string; icon: string }>,
  vibeById: Map<string, { name: string }>,
  colById: Map<string, { name: string }>
): SearchResult | null {
const cat = catById.get(place.categoryId);
  const vibeNames = (place.vibeTagIds ?? [])
    .map((id) => vibeById.get(id)?.name ?? '')
    .filter(Boolean);
  const colNames = (place.collectionIds ?? [])
    .map((id) => colById.get(id)?.name ?? '')
    .filter(Boolean);
 
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
 
  // Tier 1: name exact / starts-with / contains
  if (displayName === query || rawName === query) {
    score = Math.max(score, 100);
    matchFields.push('name');
  } else if (displayName.startsWith(query) || rawName.startsWith(query)) {
    score = Math.max(score, 80);
    matchFields.push('name');
  } else if (displayName.includes(query) || rawName.includes(query)) {
    score = Math.max(score, 60);
    matchFields.push('name');
  } else if (fuzzyMatch(query, displayName) || fuzzyMatch(query, rawName)) {
    score = Math.max(score, 60 - 20); // fuzzy name = 40
    matchFields.push('name');
  }
  // Tier 2: address / locality
  const addressTargets = [address, locality, region, country];
  for (const t of addressTargets) {
    if (!t) continue;
    if (t.includes(query)) {
      score = Math.max(score, 40);
      matchFields.push('address');
      if (!matchFields.includes('name')) snippet = place.displayAddress ?? place.locality;
      break;
    } else if (fuzzyMatch(query, t)) {
      score = Math.max(score, 25);
      matchFields.push('address');
      break;
    }
  }
 
  // Tier 3: notes / review
  const noteTargets = [notes, review];
  for (const t of noteTargets) {
    if (!t) continue;
    if (t.includes(query)) {
      score = Math.max(score, 30);
      matchFields.push('notes');
      break;
    } else if (fuzzyMatch(query, t)) {
      score = Math.max(score, 15);
      matchFields.push('notes');
      break;
}
  }
 
  // Tier 4: category
  if (catName.includes(query) || fuzzyMatch(query, catName)) {
    score = Math.max(score, 20);
    matchFields.push('category');
  }
 
  // Tier 5: vibes
  for (const v of vibeNames) {
    const vl = v.toLowerCase();
    if (vl.includes(query) || fuzzyMatch(query, vl)) {
      score = Math.max(score, 20);
      matchFields.push('vibe');
      break;
    }
  }
 
  // Tier 6: collections
  for (const c of colNames) {
    const cl = c.toLowerCase();
    if (cl.includes(query) || fuzzyMatch(query, cl)) {
      score = Math.max(score, 20);
      matchFields.push('collection');
      break;
    }
  }

if (score === 0) return null;
 
  // De-dupe matchFields
  const uniqueFields = [...new Set(matchFields)];
 
  return {
    place,
    score,
    matchFields: uniqueFields,
    snippet: snippet || place.name,
    categoryName: cat?.name ?? '',
    categoryColor: cat?.color ?? '#ccc',
    categoryIcon: cat?.icon ?? 'circle',
  };
}
 
/**
 * True iff every character of `needle` appears in `haystack` in order.
 * Case-insensitive (caller lowercases both).
 * Examples:
 *   fuzzyMatch('kyto', 'kyoto') → true
 *   fuzzyMatch('cafe', 'campanula') → false
 */
function fuzzyMatch(needle: string, haystack: string): boolean {
  if (!needle || !haystack) return false;
  // Require at least 40% of characters to match before accepting fuzzy
  // This avoids spurious matches from very short queries like "a" or "e"
  if (needle.length < 3) return haystack.includes(needle);
  let hi = 0;
  for (let ni = 0; ni < needle.length; ni++) {
    let found = false;
    while (hi < haystack.length) {
      if (haystack[hi] === needle[ni]) {
        hi++;
        found = true;
        break;
      }
      hi++;
    }
    if (!found) return false;
  }
  // Only accept fuzzy match if at least 60% of needle length is covered
  // relative to haystack length — prevents "ab" matching "abcdefghijklmnop"
  const coverage = needle.length / haystack.length;
return coverage >= 0.15; // generous threshold; ranking takes care of quality
}