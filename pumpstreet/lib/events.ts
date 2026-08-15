import { EVENT_CHANCES } from './constants';
import type { Plot, PlotEvent } from './types';

/**
 * Random events, rolled per plot at settlement.
 *
 * Events are *weight modifiers*, never extra minting. A lucky plot takes a
 * bigger slice of the same fixed pie — the invariant from docs/ECONOMY.md §0
 * survives even with heavy randomness.
 */
export function rollEvents(plot: Plot, rng: () => number): PlotEvent[] {
  const out: PlotEvent[] = [];
  const b = plot.building;

  if (rng() < EVENT_CHANCES.BLOCK_PARTY) {
    out.push({
      kind: 'BLOCK_PARTY',
      weightMod: 1.4,
      conditionDelta: 0,
      note: 'Block party — the whole street showed up.',
    });
  }

  // Enterprise gets inspected; a well-kept building passes.
  if (b.path === 'ENTERPRISE' && rng() < EVENT_CHANCES.HEALTH_INSPECTOR) {
    const passed = b.condition > 80;
    out.push({
      kind: 'HEALTH_INSPECTOR',
      weightMod: passed ? 1.0 : 0.5,
      conditionDelta: 0,
      note: passed
        ? 'Health inspector visited. Spotless — no penalty.'
        : 'Health inspector visited. Cited for condition; half earnings today.',
    });
  }

  if (rng() < EVENT_CHANCES.BURST_PIPE) {
    out.push({
      kind: 'BURST_PIPE',
      weightMod: 1.0,
      conditionDelta: -15,
      note: 'Burst pipe. Condition took a hit.',
    });
  }

  if (rng() < EVENT_CHANCES.CELEBRITY) {
    out.push({
      kind: 'CELEBRITY',
      weightMod: 2.5,
      conditionDelta: 0,
      note: 'Celebrity sighting outside your door.',
    });
  }

  // Residential tenants walk out if you let the place rot.
  if (b.path === 'RESIDENTIAL' && b.condition < 50 && rng() < EVENT_CHANCES.RENT_STRIKE) {
    out.push({
      kind: 'RENT_STRIKE',
      weightMod: 0,
      conditionDelta: 0,
      note: 'Rent strike. Tenants are withholding until you fix the place.',
    });
  }

  if (rng() < EVENT_CHANCES.VIRAL_MOMENT) {
    out.push({
      kind: 'VIRAL_MOMENT',
      weightMod: 4.0,
      conditionDelta: 0,
      note: 'Your storefront went viral. Permanent badge earned.',
    });
  }

  if (rng() < EVENT_CHANCES.PERMIT_AUDIT) {
    out.push({
      kind: 'PERMIT_AUDIT',
      weightMod: 1.0,
      conditionDelta: 0,
      note: 'Permit audit. Build cooldown extended 12h.',
    });
  }

  return out;
}

/** Combined multiplicative weight modifier from a day's events. */
export function eventWeightMod(events: PlotEvent[]): number {
  return events.reduce((m, e) => m * e.weightMod, 1);
}

/** Combined immediate condition delta from a day's events. */
export function eventConditionDelta(events: PlotEvent[]): number {
  return events.reduce((d, e) => d + e.conditionDelta, 0);
}
