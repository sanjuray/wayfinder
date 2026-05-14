import { Injectable } from '@angular/core';
import { v4 as uuid } from 'uuid';

/**
 * Wraps uuid so we can mock it in tests for deterministic IDs.
 */
@Injectable({ providedIn: 'root' })
export class IdService {
  newId(): string {
    return uuid();
  }
}