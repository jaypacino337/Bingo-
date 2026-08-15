import {
  DISTRICT_SHARES,
  EMISSION_FLOOR,
  LOT_SIZE_SHARES,
  SEASON_1_DAILY,
  SEASON_DAYS,
  SEASON_DECAY,
} from './constants';
import { makeRng, weightedPick } from './rng';
import type { District, Plot } from './types';

/**
 * Plot generation.
 *
 * Land attributes are rolled deterministically from the collection seed, so the
 * full distribution can be published and verified before mint. Nobody has to
 * trust that the rare lots weren't handed out to insiders — the seed proves it.
 */

const PLOTS_PER_BLOCK = 20;
const LANDMARK_CHANCE = 0.015;
const CORNER_LOT_CHANCE = 0.12;

export function generatePlot(plotNumber: number, collectionSeed: number): Plot {
  const rng = makeRng((collectionSeed ^ (plotNumber * 2654435761)) >>> 0);

  const district = weightedPick<District>(rng, DISTRICT_SHARES);
  const lotSize = Number(
    weightedPick(rng, LOT_SIZE_SHARES as unknown as Record<string, number>),
  ) as 1 | 2 | 3 | 4;
  const frontage = (1 + Math.floor(rng() * 3)) as 1 | 2 | 3;

  return {
    id: `plot-${plotNumber}`,
    owner: '',
    land: {
      plotNumber,
      district,
      lotSize,
      frontage,
      cornerLot: rng() < CORNER_LOT_CHANCE,
      landmark: rng() < LANDMARK_CHANCE,
      block: Math.floor((plotNumber - 1) / PLOTS_PER_BLOCK) + 1,
    },
    building: {
      path: null,
      tier: 0,
      condition: 100,
      sector: null,
      stance: null,
      leaseEndsAt: null,
      leaseTermDays: null,
      tenantQuality: null,
      staked: false,
      streakDays: 0,
      debt: 0,
      cooldowns: {
        buildUntil: null,
        pathChangeUntil: null,
        stanceUntil: null,
        unstakeUntil: null,
      },
    },
  };
}

export function generateCollection(supply: number, collectionSeed: number): Plot[] {
  return Array.from({ length: supply }, (_, i) => generatePlot(i + 1, collectionSeed));
}

/**
 * Daily emission for a given day index, decaying each season and flooring so
 * the economy never stops paying entirely.
 */
export function dailyEmissionForDay(day: number): number {
  const season = Math.floor(day / SEASON_DAYS);
  const raw = SEASON_1_DAILY * Math.pow(SEASON_DECAY, season);
  return Math.max(EMISSION_FLOOR, Math.round(raw));
}

/** Total emitted across a horizon — used to size the rewards treasury. */
export function cumulativeEmission(days: number): number {
  let total = 0;
  for (let d = 0; d < days; d++) total += dailyEmissionForDay(d);
  return total;
}
