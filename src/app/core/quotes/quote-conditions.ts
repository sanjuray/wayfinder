import type { Place } from '../models';
import type { DynamicConditionId } from './quote-bank';

export interface QuoteContext {
  places: Place[];
}

export interface ConditionResult {
  applies: boolean;
  placeholders: Record<string, string>;
}

/**
 * Each dynamic quote has a condition function. Returns whether the quote
 * applies AND the values to fill into its placeholders if so.
 */
const CONDITIONS: Record<DynamicConditionId, (ctx: QuoteContext) => ConditionResult> = {
  // "you saved {plannedCount}. you've visited {visitedCount}. that math is rude."
  // Fires when planned >= 10 AND visited < 40% of total.
  'lazy-ratio': (ctx): ConditionResult => {
    const planned = ctx.places.filter((p) => p.status === 'planned').length;
    const visited = ctx.places.filter((p) => p.status === 'visited').length;
    const total = planned + visited;
    if (total < 10) return { applies: false, placeholders: {} };
    const visitedRatio = visited / total;
    if (visitedRatio >= 0.4) return { applies: false, placeholders: {} };
    return {
      applies: true,
      placeholders: {
        plannedCount: String(planned),
        visitedCount: String(visited),
      },
    };
  },
  // "that pin from {monthName} is filing for emancipation."
  // Fires when there's a planned pin older than 90 days.
  'old-pin-month': (ctx): ConditionResult => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const oldPlanned = ctx.places
      .filter((p) => p.status === 'planned')
      .filter((p) => new Date(p.createdAt).getTime() < ninetyDaysAgo);
    if (oldPlanned.length === 0) return { applies: false, placeholders: {} };
    const oldest = oldPlanned.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
    const monthName = new Date(oldest.createdAt).toLocaleString('en-US', { month: 'long' });
    return {
      applies: true,
      placeholders: { monthName: monthName.toLowerCase() },
    };
  },
  // "the pin labeled '{pinName}' has been waiting longer than your last laundry."
  // Fires when a planned pin is 60+ days old.
  'old-pin-named': (ctx): ConditionResult => {
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    const oldPlanned = ctx.places
      .filter((p) => p.status === 'planned')
      .filter((p) => new Date(p.createdAt).getTime() < sixtyDaysAgo);
    if (oldPlanned.length === 0) return { applies: false, placeholders: {} };
    const oldest = oldPlanned.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
    return {
      applies: true,
      placeholders: { pinName: oldest.name },
    };
  },
};

export function evaluateCondition(
  conditionId: DynamicConditionId,
  ctx: QuoteContext
): ConditionResult {
  return CONDITIONS[conditionId](ctx);
}