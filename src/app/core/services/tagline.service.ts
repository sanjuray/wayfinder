import { Injectable, signal } from '@angular/core';

const MORNING = 'pin it. plan it. go.';
const NIGHT = 'the map of your maybe-someday.';

/**
 * Time-of-day tagline shuffle. Day = action mode; Night = reflective mode.
 * Boundary at 5am and 6pm local.
 */
@Injectable({ providedIn: 'root' })
export class TaglineService {
  private readonly _current = signal<string>(this.compute());
  readonly current = this._current.asReadonly();

  startShuffle(): void {
    this._current.set(this.compute());
    // Re-evaluate hourly — cheap and good enough for a poetic UX detail.
    setInterval(() => this._current.set(this.compute()), 60 * 60 * 1000);
  }

  private compute(): string {
    const hour = new Date().getHours();
    const isDaytime = hour >= 5 && hour < 18;
    return isDaytime ? MORNING : NIGHT;
  }
}