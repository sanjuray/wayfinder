import { ISODate } from "./place.model";

export interface VibeTag {
  id: string;
  name: string;
  isDefault: boolean;
  /**
   * When true, hide the vibe tag from selection UIs (e.g. the multi-
   * select on the place editor). Used for default tags the user doesn't
   * want without deleting them — preserves recovery option.
   *
   * Optional with default false; existing data without the field is
   * treated as visible.
   */
  hidden?: boolean;
  userId?: string;

  // Sync/v2-readiness fields. Required for backend sync last-write-wins
  // conflict resolution and soft-delete tombstone propagation.
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;

}