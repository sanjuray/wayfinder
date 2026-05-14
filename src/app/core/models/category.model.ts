export interface Category {
  id: string;
  name: string;
  icon: string; // tabler icon name (sans 'ti-' prefix)
  color: string; // hex
  isDefault: boolean;
  hidden: boolean;
  sortOrder: number;
  userId?: string; // null for system defaults, populated in v2 for custom
}