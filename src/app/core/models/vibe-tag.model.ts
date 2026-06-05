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
}