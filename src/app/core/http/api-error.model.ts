/**
 * Mirrors the backend's ApiError record exactly. `code` is the field to
 * branch on — never `error` (the HTTP status name) or `message` (English
 * text meant for humans, not string-matching). Both a duplicate-email
 * signup and a duplicate-place-id sync are HTTP 409, but they need
 * completely different frontend reactions, which is exactly why `code`
 * exists as a separate, stable field.
 */
export interface ApiError {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  fieldErrors: { field: string; message: string }[] | null;
  code: string | null;
}

/** Known, stable error codes the frontend is expected to react to specifically. */
export const API_ERROR_CODES = {
  PLACE_ID_CONFLICT: 'PLACE_ID_CONFLICT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;