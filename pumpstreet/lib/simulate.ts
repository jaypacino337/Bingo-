import { TIERS } from './constants';
import { dailyEmissionForDay, generateCollection } from './plots';
import { makeRng } from './rng';
import { repairCost } from './upgrades';
import type { MarketTick, Path, Plot, Sector } from './types';
import { applySettlement, settleDay } from './yield';

/**
 * Balance simulation.
 *
 * This exists so the numbers in docs/ECONOMY.md §10 are checked *before*
 * mainnet, not discovered after. It models a crude but honest player
 * population: most people pick a path and upgrade when they can afford it.
 */

export interface SimConfig {
  supply: number;
  /** Fraction of the collection actually minted and staked. */
  stakedShare: number;
  days: number;
  seed: number;
  /** Player mix. Must sum to ~1. */
  pathMix: Record<Path, number>;
  /** Daily SOL return used to drive market-facing sectors. */
  solDrift: number;
  solVol: number;
}

export const DEFAULT_SIM: SimConfig = {
  supply: 2000,
  stakedShare: 0.7,
  days: 180,
  seed: 42,
  pathMix: { RESIDENTIAL: 0.5, COMMERCIAL: 0.27, ENTERPRISE: 0.23 },
  solDrift: 0.0,
  solVol: 0.045,
};

export interface SimResult {
  daysRun: number;
  totalEmitted: number;
  totalBurned: number;
  burnRatio: number;
  medianDaysToTier3: number | null;
  gini: number;
  finalTierHistogram: number[];
  pathShare: Record<Path, number>;
  stakedShare: number;
}

const SECTOR_POOL: Sector[] = [
  'HEDGE_FUND',
  'PROP_DESK',
  'CASINO',
  'NIGHTCLUB',
  'TECH_STARTUP',
  'DELI',
  'GYM',
  'BARBERSHOP',
];

function pickPath(rng: () => number, mix: Record<Path, number>): Path {
  const r = rng();
  if (r < mix.RESIDENTIAL) return 'RESIDENTIAL';
  if (r < mix.RESIDENTIAL + mix.COMMERCIAL) return 'COMMERCIAL';
  return 'ENTERPRISE';
}

/** Gini coefficient of a payout distribution. 0 = perfectly equal. */
export function gini(values: number[]): number {
  const v = values.filter((x) => x >= 0).sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return 0;
  const sum = v.reduce((s, x) => s + x, 0);
  if (sum === 0) return 0;
  let cum = 0;
  for (let i = 0; i < n; i++) cum += (i + 1) * v[i];
  return (2 * cum) / (n * sum) - (n + 1) / n;
}

export function runSimulation(cfg: SimConfig = DEFAULT_SIM): SimResult {
  const rng = makeRng(cfg.seed);
  let plots = generateCollection(cfg.supply, cfg.seed);

  // ── Seed the population ────────────────────────────────────────────────────
  plots = plots.map((p) => {
    const staked = rng() < cfg.stakedShare;
    if (!staked) return p;
    const path = pickPath(rng, cfg.pathMix);
    const sector =
      path === 'RESIDENTIAL' ? null : SECTOR_POOL[Math.floor(rng() * SECTOR_POOL.length)];
    return {
      ...p,
      owner: `owner-${p.land.plotNumber}`,
      building: {
        ...p.building,
        staked: true,
        path,
        tier: 1,
        sector,
        stance: rng() < 0.5 ? 'LONG' : 'SHORT',
        leaseTermDays: path === 'COMMERCIAL' ? 14 : null,
        tenantQuality: path === 'COMMERCIAL' ? 40 + Math.floor(rng() * 60) : null,
      },
    };
  });

  const balances = new Map<string, number>();
  const avgYield = new Map<string, number>();
  const tier3Day = new Map<string, number>();
  const lifetimePayout = new Map<string, number>();

  let totalEmitted = 0;
  let totalBurned = 0;

  for (let day = 0; day < cfg.days; day++) {
    // ── Market ───────────────────────────────────────────────────────────────
    const shock = (rng() * 2 - 1) * cfg.solVol + cfg.solDrift;
    const market: MarketTick = {
      timestamp: day * 86400,
      solDelta: shock,
      btcDelta: shock * 0.6 + (rng() * 2 - 1) * 0.02,
      volatility: Math.min(1, Math.abs(shock) / cfg.solVol / 2),
      networkActivity: 0.35 + rng() * 0.4,
      degraded: false,
    };

    const emission = dailyEmissionForDay(day);
    const result = settleDay(
      { plots, market, dailyEmission: emission, seed: cfg.seed + day },
      avgYield,
    );
    totalEmitted += result.emitted;
    totalBurned += result.taxBurned;

    for (const s of result.settlements) {
      balances.set(s.plotId, (balances.get(s.plotId) ?? 0) + s.payout);
      lifetimePayout.set(s.plotId, (lifetimePayout.get(s.plotId) ?? 0) + s.payout);
      const prev = avgYield.get(s.plotId) ?? s.gross;
      avgYield.set(s.plotId, prev * 0.9 + s.gross * 0.1);
    }

    plots = applySettlement(plots, result);

    // ── Player behaviour: repair when cheap, upgrade when affordable ─────────
    plots = plots.map((p) => {
      if (!p.building.staked) return p;
      let bal = balances.get(p.id) ?? 0;
      let b = p.building;

      // Repair below 55 condition if affordable — neglect is punished hard.
      if (b.condition < 55) {
        const cost = repairCost({ ...p, building: b });
        if (bal >= cost) {
          bal -= cost;
          totalBurned += cost;
          b = { ...b, condition: 100 };
        }
      }

      // Upgrade greedily when affordable and the lot allows it.
      const capByLot = { 1: 2, 2: 3, 3: 4, 4: 5 }[p.land.lotSize] ?? 2;
      const next = b.tier + 1;
      if (next <= capByLot) {
        const cost = TIERS[next].pumpstCost;
        if (bal >= cost) {
          bal -= cost;
          totalBurned += cost;
          b = { ...b, tier: next };
          if (next >= 3 && !tier3Day.has(p.id)) tier3Day.set(p.id, day);
        }
      }

      balances.set(p.id, bal);
      return { ...p, building: b };
    });
  }

  // ── Metrics ────────────────────────────────────────────────────────────────
  const tier3Days = [...tier3Day.values()].sort((a, b) => a - b);
  const medianDaysToTier3 =
    tier3Days.length > 0 ? tier3Days[Math.floor(tier3Days.length / 2)] : null;

  const hist = new Array(TIERS.length).fill(0);
  const pathCount: Record<Path, number> = {
    RESIDENTIAL: 0,
    COMMERCIAL: 0,
    ENTERPRISE: 0,
  };
  let stakedCount = 0;

  for (const p of plots) {
    if (!p.building.staked) continue;
    stakedCount++;
    hist[p.building.tier]++;
    if (p.building.path) pathCount[p.building.path]++;
  }

  const pathShare: Record<Path, number> = {
    RESIDENTIAL: pathCount.RESIDENTIAL / Math.max(1, stakedCount),
    COMMERCIAL: pathCount.COMMERCIAL / Math.max(1, stakedCount),
    ENTERPRISE: pathCount.ENTERPRISE / Math.max(1, stakedCount),
  };

  return {
    daysRun: cfg.days,
    totalEmitted,
    totalBurned,
    burnRatio: totalEmitted > 0 ? totalBurned / totalEmitted : 0,
    medianDaysToTier3,
    gini: gini([...lifetimePayout.values()]),
    finalTierHistogram: hist,
    pathShare,
    stakedShare: stakedCount / cfg.supply,
  };
}
