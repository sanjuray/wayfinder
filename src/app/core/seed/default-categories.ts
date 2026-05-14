import type { Category } from '../models';

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Activity',        icon: 'sparkles',        color: '#7F77DD', isDefault: true, hidden: false, sortOrder: 0 },
  { name: 'Bar / Nightlife', icon: 'glass',           color: '#A32D2D', isDefault: true, hidden: false, sortOrder: 1 },
  { name: 'Beach',           icon: 'umbrella',        color: '#85B7EB', isDefault: true, hidden: false, sortOrder: 2 },
  { name: 'Café',            icon: 'coffee',          color: '#BA7517', isDefault: true, hidden: false, sortOrder: 3 },
  { name: 'Landmark',        icon: 'building',        color: '#888780', isDefault: true, hidden: false, sortOrder: 4 },
  { name: 'Other',           icon: 'circle',          color: '#5F5E5A', isDefault: true, hidden: false, sortOrder: 5 },
  { name: 'Park / Nature',   icon: 'tree',            color: '#1D9E75', isDefault: true, hidden: false, sortOrder: 6 },
  { name: 'Restaurant',      icon: 'tools-kitchen-2', color: '#D85A30', isDefault: true, hidden: false, sortOrder: 7 },
  { name: 'Shopping',        icon: 'shopping-bag',    color: '#BA7517', isDefault: true, hidden: false, sortOrder: 8 },
  { name: 'Stay',            icon: 'bed',             color: '#0C447C', isDefault: true, hidden: false, sortOrder: 9 },
  { name: 'Street food',     icon: 'meat',            color: '#993556', isDefault: true, hidden: false, sortOrder: 10 },
  { name: 'Temple',          icon: 'building-arch',   color: '#534AB7', isDefault: true, hidden: false, sortOrder: 11 },
  { name: 'Trek / Hike',     icon: 'mountain',        color: '#0F6E56', isDefault: true, hidden: false, sortOrder: 12 },
  { name: 'Viewpoint',       icon: 'mountain',        color: '#185FA5', isDefault: true, hidden: false, sortOrder: 13 },
];