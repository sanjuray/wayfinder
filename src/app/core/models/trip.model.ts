import type { ISODate } from './place.model';

export type TravelMode = 'auto' | 'walking' | 'driving' | 'cycling' | 'transit';

export interface TripStop {
  id: string;
  placeId: string;
  orderIndex: number;
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