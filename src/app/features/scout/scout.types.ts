import type { Place } from '../../core/models';
 
/**
 * Scout wire + UI types.
 */
 
export type ScoutResponseType = 'search' | 'trip' | 'clarification' | 'none';
 
export interface ScoutQueryRequest {
  message: string;
  userLat?: number;
  userLng?: number;
}
 
export interface ScoutQueryResponse {
  responseType: ScoutResponseType;
  message: string;
  places: Place[];
  reasoning: string;
}

/**
 * A single turn in the live Scout conversation (session UI state).
 *
 * A turn may carry `places` (freshly answered, resolved objects) and/or
 * `placeIds` (the durable id list, also what a reopened saved conversation
 * provides). The thread component always resolves ids against the current
 * places store for display, so `placeIds` is the source of truth and `places`
 * is just the convenient fresh copy.
 */
export interface ScoutTurn {
  id: string;
  role: 'user' | 'scout';
  text: string;
  /** Resolved places from a fresh answer (optional). */
  places?: Place[];
  /** Durable place-id references — present on fresh + reopened turns. */
  placeIds?: string[];
  responseType?: ScoutResponseType;
  reasoning?: string;
  /** True while the query is in flight (shows the thinking indicator). */
  pending?: boolean;
  /** True if this scout turn is an error state. */
  error?: boolean;
}
