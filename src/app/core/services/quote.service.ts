import { Injectable, inject } from '@angular/core';
import { PlacesStore } from '../stores/places.store';
import { AppStateStore } from '../stores/app-state.store';
import { QUOTE_BANK, type StaticQuote, type DynamicQuote } from '../quotes/quote-bank';
import { evaluateCondition } from '../quotes/quote-conditions';

const RECENT_HISTORY_LIMIT = 7;
const DYNAMIC_QUOTE_PROBABILITY = 0.4;

@Injectable({ providedIn: 'root' })
export class QuoteService {
  private placesStore = inject(PlacesStore);
  private appState = inject(AppStateStore);

  /** Recently shown quote texts, oldest first. Caps at RECENT_HISTORY_LIMIT. */
  private recentlyShown: string[] = [];

  /**
   * Pick a quote appropriate for the user's current state.
   * Returns the rendered text, or null if (very rarely) no quote could be picked.
   */
  pick(): string | null {
    const tauntingEnabled = this.appState.taunting().enabled;
    const dynamicEnabled = this.appState.taunting().dynamicQuotesEnabled;

    // 40% chance to try a dynamic quote first
    if (dynamicEnabled && Math.random() < DYNAMIC_QUOTE_PROBABILITY) {
      const dynamicResult = this.tryPickDynamic(tauntingEnabled);
      if (dynamicResult) {
        this.recordShown(dynamicResult);
        return dynamicResult;
      }
    }

    // Fall back to a random static quote
    const staticResult = this.pickStatic(tauntingEnabled);
    if (staticResult) {
      this.recordShown(staticResult);
    }
    return staticResult;
  }

  /** Reset history (e.g. on app reload). */
  resetHistory(): void {
    this.recentlyShown = [];
  }

  // ---- private ----

  private tryPickDynamic(tauntingEnabled: boolean): string | null {
    const dynamicQuotes = QUOTE_BANK.filter(
      (q): q is DynamicQuote => q.type === 'dynamic'
    );

    const eligible = dynamicQuotes
      .filter((q) => tauntingEnabled || q.category !== 'taunting')
      .map((q) => {
        const result = evaluateCondition(q.conditionId, {
          places: this.placesStore.entities(),
        });
        return result.applies
          ? { quote: q, placeholders: result.placeholders }
          : null;
      })
      .filter(
        (x): x is { quote: DynamicQuote; placeholders: Record<string, string> } =>
          x !== null
      );

      if (eligible.length === 0) return null;

    const picked = eligible[Math.floor(Math.random() * eligible.length)];
    return this.fillPlaceholders(picked.quote.text, picked.placeholders);
  }

  private pickStatic(tauntingEnabled: boolean): string | null {
    const candidates = QUOTE_BANK.filter(
      (q): q is StaticQuote => q.type === 'static'
    )
      .filter((q) => tauntingEnabled || q.category !== 'taunting')
      .filter((q) => !this.recentlyShown.includes(q.text));

    if (candidates.length === 0) {
      // Edge case: every static quote is in recent history. Reset and try again.
      this.recentlyShown = [];
      return this.pickStatic(tauntingEnabled);
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    return picked.text;
  }

  private fillPlaceholders(text: string, placeholders: Record<string, string>): string {
    let result = text;
    for (const [key, value] of Object.entries(placeholders)) {
      result = result.replaceAll(`{${key}}`, value);
    }
    return result;
  }

  private recordShown(text: string): void {
    this.recentlyShown.push(text);
    if (this.recentlyShown.length > RECENT_HISTORY_LIMIT) {
      this.recentlyShown.shift();
    }
  }
}