import type { ISODate } from './place.model';

export type TravelMode = 'auto' | 'walking' | 'driving' | 'cycling' | 'transit';

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
  visitedDuringTrip: boolean;
}

export interface Trip {
  id: string;
  name: string;
  plannedDate?: ISODate;
  stops: TripStop[];
  defaultTravelMode: TravelMode;
  notes?: string;
  isCompleted: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
  ownerId?: string;
  collaboratorIds?: string[];
}