import type { ISODate } from '../models';
 
/**
 * A saved Scout conversation — a reopenable thread. A user-owned entity that
 * rides the same sync cycle as Place/Collection/Trip, hence the standard
 * id/createdAt/updatedAt/deletedAt fields.
 *
 * Place references live inside each turn as IDS ONLY (persistedPlaceIds).
 * On reopen, the app re-resolves them against the current places store — a
 * renamed/moved place shows its current state; a deleted one is shown as
 * "no longer saved". Nothing about the place itself is frozen here.
 */

export type ScoutTurnRole = 'user' | 'scout';
export type ScoutResponseType = 'search' | 'trip' | 'clarification' | 'none';
 
/**
 * The persisted shape of one turn. This is what goes to storage/sync — note it
 * carries placeIds, NOT resolved Place objects. The live UI turn (ScoutTurn in
 * the feature's scout.types.ts) is richer and transient; this is the durable
 * subset.
 */
export interface PersistedScoutTurn {
  id: string;
  role: ScoutTurnRole;
  text: string;
  /** Scout turns only: ids of matched places, in ranked (or trip) order. */
  placeIds?: string[];
  responseType?: ScoutResponseType;
  reasoning?: string;
}

export interface ScoutConversation {
  id: string;
  /** Short title derived from the first user message; may be empty. */
  title: string;
  turns: PersistedScoutTurn[];
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
  userId?: string;
}
