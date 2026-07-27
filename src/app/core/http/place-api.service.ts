import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ERROR_CODES, type ApiError } from './api-error.model';
import type { Place } from '../models';

/**
 * The place-related HTTP calls only — NOT the full StorageAdapter. Building
 * the complete HttpAdapter (all 24 StorageAdapter methods, with collections/
 * trips/categories/vibeTags still delegating to LocalStorageAdapter until
 * their own backend endpoints exist) is still a separate, later step. This
 * service exists now specifically to hold the PLACE_ID_CONFLICT retry logic
 * discussed alongside it — the one thing that needed a home to actually be
 * testable, rather than described in the abstract.
 */
@Injectable({ providedIn: 'root' })
export class PlaceApiService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  /**
   * PUT /api/places/{id}, with exactly one silent retry if the id happens
   * to collide with a place already owned by someone else (see PlaceService
   * .upsert on the backend — this is a client-generated-UUID collision,
   * astronomically unlikely with UUIDv4, but handled correctly rather than
   * assumed impossible).
   *
   * The retry is deliberately silent: this isn't a mistake the user made,
   * so there's nothing for them to see or act on. If the retry ALSO
   * conflicts, that's no longer bad luck — something else is wrong — so the
   * second failure is allowed to propagate as a real error instead of
   * looping forever.
   */
  async upsertPlace(place: Place): Promise<Place> {
    return this.upsertWithRetry(place, /* alreadyRetried */ false);
  }

  private async upsertWithRetry(place: Place, alreadyRetried: boolean): Promise<Place> {
    try {
      return await firstValueFrom(
        this.http.put<Place>(`${this.base}/places/${place.id}`, place)
      );
    } catch (err) {
      const apiError = this.extractApiError(err);

      if (apiError?.code === API_ERROR_CODES.PLACE_ID_CONFLICT && !alreadyRetried) {
        const retried: Place = { ...place, id: crypto.randomUUID() };
        return this.upsertWithRetry(retried, /* alreadyRetried */ true);
      }

      // Not a recoverable id conflict, or already retried once — surface it.
      throw err;
    }
}

  private extractApiError(err: unknown): ApiError | null {
    if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
      return err.error as ApiError;
    }
    return null;
  }
}