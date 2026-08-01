import type { Category } from '../models';
 
/**
 * Default categories seeded on first launch.
 *
 * IMPORTANT — ids are FIXED, not generated.
 * These must be deterministic so that every device/browser seeds the *same*
 * logical category with the *same* id. If they were random (idService.newId()),
 * two devices would each create their own "Café" with different ids, and sync
 * would merge both → duplicates. A stable id makes the server-side upsert
 * idempotent: device B's "Café" and device A's "Café" collide on id and dedupe.
 *
 * The `wf-cat-` prefix namespaces them and makes them obvious in the DB/inspector.
 * NEVER change an existing id — that would orphan every place referencing it and
 * re-introduce the duplicate on already-synced accounts. Only ever append.
 */
export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt' | 'updatedAt'>[] = [
  { id: 'wf-cat-activity',   name: 'Activity',        icon: 'sparkles',        color: '#7F77DD', isDefault: true, hidden: false, sortOrder: 0 },
  { id: 'wf-cat-bar',        name: 'Bar / Nightlife', icon: 'glass',           color: '#A32D2D', isDefault: true, hidden: false, sortOrder: 1 },
  { id: 'wf-cat-beach',      name: 'Beach',           icon: 'umbrella',        color: '#85B7EB', isDefault: true, hidden: false, sortOrder: 2 },
  { id: 'wf-cat-cafe',       name: 'Café',            icon: 'coffee',          color: '#BA7517', isDefault: true, hidden: false, sortOrder: 3 },
  { id: 'wf-cat-landmark',   name: 'Landmark',        icon: 'building',        color: '#888780', isDefault: true, hidden: false, sortOrder: 4 },
  { id: 'wf-cat-other',      name: 'Other',           icon: 'circle',          color: '#5F5E5A', isDefault: true, hidden: false, sortOrder: 5 },
  { id: 'wf-cat-park',       name: 'Park / Nature',   icon: 'tree',            color: '#1D9E75', isDefault: true, hidden: false, sortOrder: 6 },
  { id: 'wf-cat-restaurant', name: 'Restaurant',      icon: 'tools-kitchen-2', color: '#D85A30', isDefault: true, hidden: false, sortOrder: 7 },
  { id: 'wf-cat-shopping',   name: 'Shopping',        icon: 'shopping-bag',    color: '#BA7517', isDefault: true, hidden: false, sortOrder: 8 },
  { id: 'wf-cat-stay',       name: 'Stay',            icon: 'bed',             color: '#0C447C', isDefault: true, hidden: false, sortOrder: 9 },
  { id: 'wf-cat-streetfood', name: 'Street food',     icon: 'meat',            color: '#993556', isDefault: true, hidden: false, sortOrder: 10 },
  { id: 'wf-cat-temple',     name: 'Temple',          icon: 'building-arch',   color: '#534AB7', isDefault: true, hidden: false, sortOrder: 11 },
  { id: 'wf-cat-trek',       name: 'Trek / Hike',     icon: 'mountain',        color: '#0F6E56', isDefault: true, hidden: false, sortOrder: 12 },
  { id: 'wf-cat-viewpoint',  name: 'Viewpoint',       icon: 'mountain',        color: '#185FA5', isDefault: true, hidden: false, sortOrder: 13 },
];