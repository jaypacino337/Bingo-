import {
  COMMERCIAL_DAMPING,
  CONDITION_DECAY_BASE,
  CONDITION_DECAY_PER_TIER,
  CONDITION_HEALTHY_FLOOR,
  CONDITION_MAX,
  CORNER_LOT_WEIGHT_BONUS,
  DISTRICT_FAVOURS,
  DISTRICT_FAVOUR_BONUS,
  DISTRICT_TAX_MULT,
  DISTRICT_WEIGHTS,
  ENTERPRISE_CEILING,
  ENTERPRISE_DEBT_CAP_DAYS,
  ENTERPRISE_FLOOR,
  LANDMARK_WEIGHT_BONUS,
  LEASE_TERM_MULT,
  PATH_BASE_MULT,
  RESIDENTIAL_NOISE,
  TAX_RATE_ON_YIELD,
  TIERS,
} from './constants';
import { eventConditionDelta, eventWeightMod, rollEvents } from './events';
import { neighbourDensity, sectorFactor, type SectorContext } from './market';
import { makeRng, noise, plotSeed } from './rng';
import type {
  Plot,
  PlotSettlement,
  SettlementInput,
  SettlementResult,
} from './types';

/**
 * Settlement.
 *
 * The invariant this file exists to protect:
 *
 *   sum(payouts) <= dailyEmission
 *
 * Weight decides *share*, never amount. No code path here can increase the
 * amount of PUMPST minted in a day. See docs/ECONOMY.md §0.
 */

/** Condition below the healthy floor scales weight down linearly to zero. */
export function conditionFactor(condition: number): number {
  if (condition >= CONDITION_HEALTHY_FLOOR) return 1;
  if (condition <= 0) return 0;
  return condition / CONDITION_HEALTHY_FLOOR;
}

/** Daily condition decay. Bigger buildings rot faster. */
export function conditionDecay(tier: number): number {
  return CONDITION_DECAY_BASE + CONDITION_DECAY_PER_TIER * tier;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Static part of a plot's weight — everything not driven by today's market. */
export function baseWeight(plot: Plot): number {
  const { land, building } = plot;
  let w = TIERS[clamp(building.tier, 0, TIERS.length - 1)].weight;

  w *= DISTRICT_WEIGHTS[land.district];

  if (building.path) {
    w *= PATH_BASE_MULT[building.path];
    if (DISTRICT_FAVOURS[land.district] === building.path) {
      w *= 1 + DISTRICT_FAVOUR_BONUS;
    }
  }

  if (land.landmark) w *= 1 + LANDMARK_WEIGHT_BONUS;
  if (land.cornerLot) w *= 1 + CORNER_LOT_WEIGHT_BONUS;

  // Frontage only matters when someone is trading out of the building.
  if (building.path === 'COMMERCIAL' || building.path === 'ENTERPRISE') {
    w *= 1 + (land.frontage - 1) * 0.06;
  }

  return w * conditionFactor(building.condition);
}

/**
 * Path-specific multiplier for today, given the market.
 * Returns the multiplier and the raw sector factor (for reporting/debt).
 */
export function pathMultiplier(
  plot: Plot,
  ctx: SectorContext,
  rng: () => number,
): { mult: number; factor: number } {
  const b = plot.building;

  if (b.path === 'RESIDENTIAL') {
    // Near-deterministic. A crash does not touch you.
    return { mult: 1 + noise(rng, RESIDENTIAL_NOISE), factor: 0 };
  }

  if (b.path === 'COMMERCIAL') {
    const term = b.leaseTermDays ?? 7;
    const termMult = LEASE_TERM_MULT[term] ?? 1.15;
    const factor = b.sector ? sectorFactor(b.sector, ctx, rng) : 0;
    // Landlords absorb only part of the tenant's swing — rent is rent.
    const damped = 1 + factor * COMMERCIAL_DAMPING;
    const quality = (b.tenantQuality ?? 50) / 100;
    const qualityMult = 0.85 + quality * 0.3;
    return { mult: Math.max(0, termMult * damped * qualityMult), factor };
  }

  if (b.path === 'ENTERPRISE') {
    const factor = b.sector ? sectorFactor(b.sector, ctx, rng) : 0;
    // Full exposure, but bounded on both sides so a single day can't zero the
    // street or hand one plot everything.
    const mult = clamp(1 + factor, ENTERPRISE_FLOOR, ENTERPRISE_CEILING);
    return { mult, factor };
  }

  // Unassigned plot — an empty lot still holds a small amount of weight.
  return { mult: 1, factor: 0 };
}

/** Upkeep owed by a high-tier enterprise on a catastrophic day. */
function upkeepFor(plot: Plot, factor: number, avgYield: number): number {
  if (plot.building.path !== 'ENTERPRISE') return 0;
  if (factor > -0.5) return 0;
  const severity = Math.min(1, (-factor - 0.5) / 1.5);
  const tierScale = plot.building.tier / 5;
  return avgYield * severity * tierScale;
}

/**
 * Settle one UTC day.
 *
 * `avgYieldByPlot` lets debt caps scale to what a plot actually earns; pass an
 * empty map on day one.
 */
export function settleDay(
  input: SettlementInput,
  avgYieldByPlot: Map<string, number> = new Map(),
): SettlementResult {
  const { plots, market, dailyEmission, seed } = input;
  const staked = plots.filter((p) => p.building.staked);

  const density = new Map<number, number>();
  for (const p of staked) {
    if (!density.has(p.land.block)) {
      density.set(p.land.block, neighbourDensity(plots, p.land.block));
    }
  }

  // ── Pass 1: weights ────────────────────────────────────────────────────────
  interface Row {
    plot: Plot;
    weight: number;
    factor: number;
    events: ReturnType<typeof rollEvents>;
    conditionAfter: number;
  }

  const rows: Row[] = staked.map((plot) => {
    const rng = makeRng(plotSeed(seed, plot.id));
    const events = rollEvents(plot, rng);

    const ctx: SectorContext = {
      market,
      stance: plot.building.stance,
      streakDays: plot.building.streakDays,
      neighbourDensity: density.get(plot.land.block) ?? 0,
      daysSinceSectorChange: -1,
    };

    const { mult, factor } = pathMultiplier(plot, ctx, rng);
    const weight = Math.max(0, baseWeight(plot) * mult * eventWeightMod(events));

    const decayed =
      plot.building.condition -
      conditionDecay(plot.building.tier) +
      eventConditionDelta(events);

    return {
      plot,
      weight,
      factor,
      events,
      conditionAfter: clamp(decayed, 0, CONDITION_MAX),
    };
  });

  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  // ── Pass 2: payouts ────────────────────────────────────────────────────────
  const settlements: PlotSettlement[] = [];
  let distributed = 0;
  let taxBurned = 0;

  for (const row of rows) {
    const share = totalWeight > 0 ? row.weight / totalWeight : 0;
    const gross = dailyEmission * share;

    const avg = avgYieldByPlot.get(row.plot.id) ?? gross;

    // Property tax comes off the top and is burned. Taken as a share of yield
    // rather than a flat fee so it can never bankrupt a plot.
    const taxRate = TAX_RATE_ON_YIELD * DISTRICT_TAX_MULT[row.plot.land.district];
    const taxPaid = gross * Math.min(0.9, taxRate);
    taxBurned += taxPaid;

    const afterTax = gross - taxPaid;

    // Repay outstanding debt before anything reaches the owner.
    const existingDebt = row.plot.building.debt;
    const debtRepaid = Math.min(existingDebt, afterTax);
    let payout = afterTax - debtRepaid;

    // A catastrophic enterprise day can put you further underwater.
    const upkeep = upkeepFor(row.plot, row.factor, avg);
    const debtCap = avg * ENTERPRISE_DEBT_CAP_DAYS;
    const remainingDebt = existingDebt - debtRepaid;
    const debtIncurred = Math.max(0, Math.min(upkeep, debtCap - remainingDebt));

    if (debtIncurred > 0) {
      const fromPayout = Math.min(payout, debtIncurred);
      payout -= fromPayout;
    }

    distributed += payout + debtRepaid + taxPaid;

    settlements.push({
      plotId: row.plot.id,
      weight: row.weight,
      payout,
      gross,
      taxPaid,
      debtRepaid,
      debtIncurred,
      events: row.events,
      marketFactor: row.factor,
      conditionAfter: row.conditionAfter,
    });
  }

  return {
    day: Math.floor(market.timestamp / 86400),
    totalWeight,
    emitted: distributed,
    taxBurned,
    unallocated: Math.max(0, dailyEmission - distributed),
    settlements,
  };
}

/** Apply a settlement back onto the plots (mutates a copy, returns it). */
export function applySettlement(plots: Plot[], result: SettlementResult): Plot[] {
  const byId = new Map(result.settlements.map((s) => [s.plotId, s]));
  return plots.map((p) => {
    const s = byId.get(p.id);
    if (!s) return p;
    const debt = Math.max(0, p.building.debt - s.debtRepaid + s.debtIncurred);
    return {
      ...p,
      building: {
        ...p.building,
        condition: s.conditionAfter,
        debt,
        streakDays: p.building.staked ? p.building.streakDays + 1 : 0,
      },
    };
  });
}
