import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { ScoutQueryRequest, ScoutQueryResponse } from './scout.types';

/**
 * Talks to POST /api/scout/query. The credentials interceptor attaches the
 * auth cookie automatically, same as every other backend call — nothing
 * Scout-specific to do here.
 */
@Injectable({ providedIn: 'root' })
export class ScoutService {
  private http = inject(HttpClient);
  private base = environment.apiBaseUrl;

  async query(request: ScoutQueryRequest): Promise<ScoutQueryResponse> {
    return firstValueFrom(
      this.http.post<ScoutQueryResponse>(`${this.base}/scout/query`, request)
    );
  }
}