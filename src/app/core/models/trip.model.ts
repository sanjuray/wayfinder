import type { ISODate } from './place.model';

export type TravelMode =
  | 'auto'
  | 'walking'
  | 'driving'
  | 'motorcycle'
  | 'transit';

/**
 * A single stop in a trip. Order is determined by the index of this stop in
 * the parent Trip's `stops` array — there is no separate `orderIndex` field.
 * (Removed in Phase 6 per PHASES_DETAIL.md: "Trip's `stops` array order
 * matters and IS the source of truth. Don't introduce a separate `order`
 * field." The pre-Phase-6 model declared orderIndex but nothing ever read
 * it, so dropping it is safe.)
 */
export interface TripStop {
  id: string;
  placeId: string;
  perStopNote?: string;
  /**
   * True iff this stop has been marked visited during a live trip
   * (Phase 7). Independent from Place.status — a place can be 'visited'
   * in general (the user has been there before) without being visited
   * *during this particular trip*.
   */
  visitedDuringTrip: boolean;
  /**
   * When the stop was marked visited during this trip. Optional even
   * when visitedDuringTrip is true (existing data pre-Phase-7 won't
   * have it). Used to determine the "most-recently visited" stop, which
   * is where the avatar marker sits on the map.
   */
  visitedAt?: ISODate;
}

export interface Trip {
  id: string;
  name: string;
  plannedDate?: ISODate;
  stops: TripStop[];
  defaultTravelMode: TravelMode;
  notes?: string;
  isCompleted: boolean;
  /**
   * Set when the user explicitly starts a trip OR auto-set when they mark
   * the first stop visited (Phase 7 hybrid behavior). Drives the "in
   * progress" section in /trips and the live planner UI (avatar marker,
   * split polyline). Cleared when the user unmarks all visited stops AND
   * the trip is not yet completed.
   *
   * Why a timestamp rather than a boolean: lets us show "started 2 hours
   * ago" later, and is more honest about state. boolean would lose info.
   */
  startedAt?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
  ownerId?: string;
  collaboratorIds?: string[];
}