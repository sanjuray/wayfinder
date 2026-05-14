import type { ISODate } from './place.model';

export type Visibility = 'private' | 'shared' | 'public';

export interface Collection {
  id: string;
  name: string;
  coverImageUrl?: string;
  ownerId?: string; // populated in v2 with user auth
  collaboratorIds?: string[]; // populated in v2 for shared collections
  visibility: Visibility; // always 'private' in v1
  createdAt: ISODate;
  updatedAt: ISODate;
  deletedAt?: ISODate;
}