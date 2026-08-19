import {
  Component, inject, input, output, signal, computed,
  ChangeDetectionStrategy, ViewChild, ElementRef, effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ScoutStateService } from './scout-state.service';
import { ScoutResultCardComponent } from './scout-result-card.component';
import { ScoutMapComponent } from './scout-map.component';
import { PlacesStore } from '../../core/stores/places.store';
import type { Place } from '../../core/models';
import type { ScoutTurn } from './scout.types';

/**
 * The conversation surface. Renders the thread (user + scout turns), inline
 * result cards, a mini map per result turn, and the input bar. Shared by the
 * compact panel and the fullscreen view.
 *
 * Place resolution: a turn may carry resolved `places` (fresh answers) OR only
 * `placeIds` (a reopened saved conversation). resolvedPlaces() unifies both by
 * always resolving against the CURRENT places store — so reopened threads show
 * places as they are now. Ids that no longer resolve are surfaced as a
 * "no longer saved" count rather than silently dropped.
 *
 * Keyboard: Enter sends. Arrow Up/Down move focus through the latest result
 * cards. Escape is handled by the host (bubble/fullscreen), not here.
 *
 * Geolocation is requested lazily, only on send — never on load.
 */
@Component({
  selector: 'wf-scout-thread',
  standalone: true,
  imports: [FormsModule, ScoutResultCardComponent, ScoutMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="thread" #threadEl>
      @if (!state.hasConversation()) {
        <div class="intro">
          <div class="mark">◇</div>
          <p class="tagline">you command, i materialize</p>
          <div class="suggestions">
            @for (s of suggestions; track s) {
              <button class="suggestion" (click)="askSuggestion(s)">{{ s }}</button>
            }
          </div>
        </div>
      }

      @for (turn of state.thread(); track turn.id) {
        @if (turn.role === 'user') {
          <div class="turn user"><div class="bubble">{{ turn.text }}</div></div>
        } @else {
          <div class="turn scout">
            @if (turn.pending) {
              <div class="thinking" role="status" aria-label="Scout is thinking">
                <span></span><span></span><span></span>
              </div>
            } @else {
              <div class="bubble" [class.error]="turn.error">{{ turn.text }}</div>
 
              @let resolved = resolvedPlaces(turn);
              @if (resolved.places.length) {
                <div class="results">
                  <div class="result-map">
                    <wf-scout-map [places]="resolved.places" (select)="onSelect($event)" />
                  </div>
<div class="result-list" role="list">
                    @for (p of resolved.places; track p.id; let i = $index) {
                      <div role="listitem">
                        <wf-scout-result-card
                          [place]="p"
                          [index]="turn.responseType === 'trip' ? i + 1 : 0"
                          (select)="onSelect($event)" />
                      </div>
                    }
                  </div>
                  @if (resolved.missing > 0) {
                    <p class="missing">
                      {{ resolved.missing }}
                      {{ resolved.missing === 1 ? 'place is' : 'places are' }}
                      no longer saved.
                    </p>
                  }
                  @if (turn.reasoning) {
                    <details class="why">
                      <summary>why these?</summary>
                      <p>{{ turn.reasoning }}</p>
                    </details>
                  }
                </div>
              }
            }
          </div>
        }
      }
    </div>
 
    <div class="composer">
      <input
        #inputEl
        class="composer-input"
        [(ngModel)]="draft"
        (keydown.enter)="send()"
        (keydown.arrowdown)="focusFirstResult($event)"
        [disabled]="state.isThinking()"
        placeholder="Ask Scout to find places or plan a trip…"
        aria-label="Ask Scout" />
      <button
        class="send"
        (click)="send()"
        [disabled]="state.isThinking() || !draft.trim()"
        aria-label="Send">→</button>
    </div>
  `,
  styleUrl: './scout-thread.component.css',
})
export class ScoutThreadComponent {
  protected state = inject(ScoutStateService);
  private places = inject(PlacesStore);
  private router = inject(Router);
 
  /** When set, selecting a result closes the panel first (compact mode). */
  readonly closeOnSelect = input<boolean>(false);
  readonly placeSelected = output<Place>();
 
  protected draft = '';
 
  protected readonly suggestions = [
    'Find me a peaceful nature spot',
    'Cafés within 5 km of me',
    'Plan a short trip around Hyderabad',
    'Show my favorite places',
  ];
 
  @ViewChild('threadEl') threadEl?: ElementRef<HTMLDivElement>;
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  constructor() {
    // Auto-scroll to the latest turn whenever the thread grows.
    effect(() => {
      this.state.thread();
      queueMicrotask(() => {
        const el = this.threadEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }
 
  /**
   * Resolve a turn's place references against the CURRENT places store.
   * Handles both fresh turns (turn.places present) and reopened ones
   * (turn.placeIds only). Returns the live places in order plus a count of
   * ids that no longer resolve (deleted since the answer).
   */
  protected resolvedPlaces(turn: ScoutTurn): { places: Place[]; missing: number } {
    const ids = turn.placeIds ?? (turn.places ?? []).map((p) => p.id);
    if (!ids.length) return { places: [], missing: 0 };
 
    const live: Place[] = [];
    let missing = 0;
    for (const id of ids) {
      const p = this.places.getById(id);
      if (p && !p.deletedAt) live.push(p);
      else missing++;
    }
    return { places: live, missing };
  }
 
  protected askSuggestion(text: string): void {
    this.draft = text;
    this.send();
  }

  protected async send(): Promise<void> {
    const message = this.draft.trim();
    if (!message || this.state.isThinking()) return;
    this.draft = '';
 
    const coords = await this.tryGetLocation();
    await this.state.ask(message, coords);
  }
 
  protected onSelect(place: Place): void {
    this.placeSelected.emit(place);
    if (this.closeOnSelect()) {
      this.state.close();
    }
    // Fly the home map to the place and open its detail via query param.
    // The home component watches ?scout=:id — it opens the read-only place
    // detail panel and pans the map, distinct from ?edit=:id (add/edit modal).
    this.router.navigate(['/'], {
      queryParams: { scout: place.id },
      queryParamsHandling: 'merge',
    });
  }

  /** Arrow-down from the input jumps focus to the first result card button. */
  protected focusFirstResult(event: Event): void {
    const el = this.threadEl?.nativeElement;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('.result-list .main');
    if (first) {
      event.preventDefault();
      first.focus();
    }
  }
 
  /**
   * Best-effort geolocation. Resolves to undefined (never rejects) so a denied
   * or unavailable location just means "no coords" rather than a broken send.
   */
  private tryGetLocation(): Promise<{ lat: number; lng: number } | undefined> {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve(undefined);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { timeout: 4000, maximumAge: 300000 }
      );
    });
  }
}
