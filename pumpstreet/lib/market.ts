import {
  BARBERSHOP_STREAK_BONUS_PER_DAY,
  BARBERSHOP_STREAK_CAP,
  CASINO_JACKPOT_CHANCE,
  CASINO_JACKPOT_MULT,
  SECTORS,
  STARTUP_EXIT_CHANCE,
  STARTUP_EXIT_MULT,
} from './constants';
import { noise } from './rng';
import type { MarketTick, Plot, Sector, Stance } from './types';

/**
 * Sector performance for one settlement.
 *
 * Returns a *relative* factor centred on 0: positive is a good day, negative is
 * a bad one. Callers convert this into a weight multiplier. Nothing here mints
 * tokens — a great day takes a bigger slice of a fixed pie, it does not grow it.
 */

export interface SectorContext {
  market: MarketTick;
  /** ENTERPRISE directional sectors only. */
  stance: Stance | null;
  /** Consecutive staked days — BARBERSHOP. */
  streakDays: number;
  /** Staked + upgraded neighbours on the same block — GYM. */
  neighbourDensity: number;
  /** Days since this plot last changed sector — GRAND_OPENING window. */
  daysSinceSectorChange: number;
}

/**
 * The driver value for a sector, before beta/noise. This is the hook into real
 * market data: HEDGE_FUND and PROP_DESK read Pyth deltas, the rest are internal.
 */
export function sectorDriver(sector: Sector, ctx: SectorContext): number {
  const { market } = ctx;

  // A degraded oracle read voids the day rather than settling on bad data.
  if (market.degraded) return 0;

  switch (sector) {
    case 'HEDGE_FUND':
      return market.solDelta;
    case 'PROP_DESK':
      return market.btcDelta;
    case 'DELI':
      // Inverse volatility: delis print when markets are calm. This is the
      // economy's internal stabiliser and the reason to hold more than one plot.
      return 0.12 - market.volatility * 0.35;
    case 'NIGHTCLUB': {
      const day = new Date(market.timestamp * 1000).getUTCDay();
      const weekend = day === 5 || day === 6 ? 0.35 : -0.12;
      return weekend + (market.networkActivity - 0.5) * 0.4;
    }
    case 'GYM':
      return (ctx.neighbourDensity - 0.5) * 0.5;
    case 'BARBERSHOP':
      return Math.min(
        ctx.streakDays * BARBERSHOP_STREAK_BONUS_PER_DAY,
        BARBERSHOP_STREAK_CAP,
      );
    case 'CASINO':
    case 'TECH_STARTUP':
      return 0; // pure RNG, handled below
  }
}

/**
 * Full sector factor including direction, beta, noise and lottery outcomes.
 * Centred on 0. Roughly bounded to [-1, +1] except for jackpot/exit events.
 */
export function sectorFactor(
  sector: Sector,
  ctx: SectorContext,
  rng: () => number,
): number {
  const spec = SECTORS[sector];
  const driver = sectorDriver(sector, ctx);

  let factor = spec.base + driver * spec.beta;

  // Directional sectors: the stance decides whether the move helps or hurts.
  // This is the "hedge fund went long and the market crashed" case.
  if (spec.directional) {
    const sign = ctx.stance === 'SHORT' ? -1 : 1;
    factor = spec.base + driver * spec.beta * sign;
  }

  // Lottery sectors.
  if (sector === 'CASINO' && rng() < CASINO_JACKPOT_CHANCE) {
    factor += CASINO_JACKPOT_MULT;
  }
  if (sector === 'TECH_STARTUP' && rng() < STARTUP_EXIT_CHANCE) {
    factor += STARTUP_EXIT_MULT;
  }

  // Grand opening window.
  if (ctx.daysSinceSectorChange >= 0 && ctx.daysSinceSectorChange < 3) {
    factor += 0.25;
  }

  return factor + noise(rng, spec.noise);
}

/** Neighbour density on a block: share of plots staked and at tier >= 2. */
export function neighbourDensity(plots: Plot[], block: number): number {
  const onBlock = plots.filter((p) => p.land.block === block);
  if (onBlock.length === 0) return 0;
  const active = onBlock.filter((p) => p.building.staked && p.building.tier >= 2);
  return active.length / onBlock.length;
}

/**
 * Build a MarketTick from raw oracle reads.
 *
 * `confidenceRatio` is Pyth's confidence interval over the price. A wide band
 * means the feed is unreliable, so we mark the day degraded and settle neutral
 * rather than paying out on a number we do not trust.
 */
export function tickFromOracle(params: {
  timestamp: number;
  solOpen: number;
  solClose: number;
  btcOpen: number;
  btcClose: number;
  volatility: number;
  networkActivity: number;
  confidenceRatio: number;
}): MarketTick {
  const DEGRADED_THRESHOLD = 0.01; // 1% confidence band is already very wide
  return {
    timestamp: params.timestamp,
    solDelta: (params.solClose - params.solOpen) / params.solOpen,
    btcDelta: (params.btcClose - params.btcOpen) / params.btcOpen,
    volatility: params.volatility,
    networkActivity: params.networkActivity,
    degraded: params.confidenceRatio > DEGRADED_THRESHOLD,
  };
}
