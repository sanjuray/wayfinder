import { ISODate } from "./place.model";

export interface Category {
  id: string;
  name: string;
  icon: string; // tabler icon name (sans 'ti-' prefix)
  color: string; // hex
  isDefault: boolean;
  hidden: boolean;
  sortOrder: number;
  userId?: string; // null for system defaults, populated in v2 for custom

  // Sync/v2-readiness fields. Required for backend sync last-write-wins
  // conflict resolution and soft-delete tombstone propagation.
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;

}