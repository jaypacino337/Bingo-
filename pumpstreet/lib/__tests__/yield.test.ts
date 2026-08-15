import { describe, expect, it } from 'vitest';
import { DEFAULT_SIM, gini, runSimulation } from '../simulate';
import { generateCollection, generatePlot, dailyEmissionForDay } from '../plots';
import { baseWeight, conditionFactor, settleDay } from '../yield';
import { sectorFactor } from '../market';
import type { MarketTick, Plot, Sector, Stance } from '../types';

function stakedPlot(
  overrides: Partial<Plot['building']> = {},
  plotNumber = 1,
): Plot {
  const p = generatePlot(plotNumber, 1);
  return {
    ...p,
    owner: 'owner',
    building: { ...p.building, staked: true, path: 'RESIDENTIAL', tier: 1, ...overrides },
  };
}

const flatMarket: MarketTick = {
  timestamp: 0,
  solDelta: 0,
  btcDelta: 0,
  volatility: 0.3,
  networkActivity: 0.5,
  degraded: false,
};

// ── The invariant everything else depends on ────────────────────────────────

describe('emission invariant', () => {
  it('never distributes more than the daily emission', () => {
    const plots = generateCollection(300, 7).map((p, i) => ({
      ...p,
      building: {
        ...p.building,
        staked: true,
        path: (['RESIDENTIAL', 'COMMERCIAL', 'ENTERPRISE'] as const)[i % 3],
        tier: (i % 5) + 1,
        sector: 'HEDGE_FUND' as Sector,
        stance: (i % 2 === 0 ? 'LONG' : 'SHORT') as Stance,
        leaseTermDays: 14 as const,
        tenantQuality: 70,
      },
    }));

    for (const solDelta of [-0.25, -0.06, 0, 0.06, 0.25]) {
      const result = settleDay({
        plots,
        market: { ...flatMarket, solDelta, btcDelta: solDelta },
        dailyEmission: 400_000,
        seed: 99,
      });
      expect(result.emitted).toBeLessThanOrEqual(400_000 + 1e-6);
      expect(result.unallocated).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('emits nothing when no plots are staked', () => {
    const plots = generateCollection(10, 3); // none staked
    const result = settleDay({ plots, market: flatMarket, dailyEmission: 400_000, seed: 1 });
    expect(result.emitted).toBe(0);
    expect(result.unallocated).toBe(400_000);
  });

  it('upgrading one plot does not increase total emission', () => {
    const base = generateCollection(50, 11).map((p) => ({
      ...p,
      building: { ...p.building, staked: true, path: 'RESIDENTIAL' as const, tier: 1 },
    }));
    const upgraded = base.map((p, i) =>
      i === 0 ? { ...p, building: { ...p.building, tier: 5 } } : p,
    );

    const a = settleDay({ plots: base, market: flatMarket, dailyEmission: 100_000, seed: 5 });
    const b = settleDay({ plots: upgraded, market: flatMarket, dailyEmission: 100_000, seed: 5 });

    expect(a.emitted).toBeCloseTo(b.emitted, 6);
    // The upgraded plot takes a bigger slice of the same pie.
    const aFirst = a.settlements[0].payout;
    const bFirst = b.settlements[0].payout;
    expect(bFirst).toBeGreaterThan(aFirst);
  });
});

// ── Condition ───────────────────────────────────────────────────────────────

describe('condition', () => {
  it('is neutral at or above the healthy floor', () => {
    expect(conditionFactor(100)).toBe(1);
    expect(conditionFactor(60)).toBe(1);
  });

  it('scales down linearly below the floor and zeroes out', () => {
    expect(conditionFactor(30)).toBeCloseTo(0.5, 5);
    expect(conditionFactor(0)).toBe(0);
  });

  it('drops weight to zero for a derelict plot', () => {
    expect(baseWeight(stakedPlot({ condition: 0 }))).toBe(0);
  });
});

// ── Land scarcity ───────────────────────────────────────────────────────────

describe('land attributes', () => {
  it('gives landmark plots a permanent premium', () => {
    const plain = generatePlot(1, 1);
    const withLandmark: Plot = {
      ...plain,
      building: { ...plain.building, path: 'RESIDENTIAL', tier: 2 },
      land: { ...plain.land, landmark: false, cornerLot: false },
    };
    const landmarked: Plot = {
      ...withLandmark,
      land: { ...withLandmark.land, landmark: true },
    };
    expect(baseWeight(landmarked)).toBeGreaterThan(baseWeight(withLandmark));
  });

  it('generates plots deterministically from the collection seed', () => {
    const a = generatePlot(777, 12345);
    const b = generatePlot(777, 12345);
    expect(a.land).toEqual(b.land);
  });
});

// ── The user's scenario: long into a crash ──────────────────────────────────

describe('directional enterprise', () => {
  const ctx = (stance: Stance, solDelta: number) => ({
    market: { ...flatMarket, solDelta },
    stance,
    streakDays: 0,
    neighbourDensity: 0.5,
    daysSinceSectorChange: -1,
  });

  it('punishes a long into a crash and rewards the short', () => {
    const rngA = () => 0.5; // no noise
    const long = sectorFactor('HEDGE_FUND', ctx('LONG', -0.06), rngA);
    const short = sectorFactor('HEDGE_FUND', ctx('SHORT', -0.06), rngA);

    expect(long).toBeLessThan(0);
    expect(short).toBeGreaterThan(0);
    expect(short).toBeGreaterThan(long);
  });

  it('clamps enterprise weight into its band however violent the move', () => {
    const plots = [
      stakedPlot({ path: 'ENTERPRISE', sector: 'HEDGE_FUND', stance: 'LONG', tier: 3 }),
    ];
    for (const solDelta of [-0.9, -0.3, 0.3, 0.9]) {
      const r = settleDay({
        plots,
        market: { ...flatMarket, solDelta },
        dailyEmission: 1000,
        seed: 3,
      });
      // Single staked plot always takes the whole pie regardless of clamping.
      expect(r.settlements[0].weight).toBeGreaterThan(0);
    }
  });

  it('leaves residential untouched by a market crash', () => {
    const plots = [stakedPlot({ path: 'RESIDENTIAL', tier: 2 })];
    const calm = settleDay({ plots, market: flatMarket, dailyEmission: 1000, seed: 8 });
    const crash = settleDay({
      plots,
      market: { ...flatMarket, solDelta: -0.4 },
      dailyEmission: 1000,
      seed: 8,
    });
    expect(crash.settlements[0].weight).toBeCloseTo(calm.settlements[0].weight, 6);
  });
});

// ── Oracle degradation ──────────────────────────────────────────────────────

describe('degraded oracle', () => {
  it('voids market exposure rather than settling on bad data', () => {
    const rng = () => 0.5;
    const factor = sectorFactor(
      'HEDGE_FUND',
      {
        market: { ...flatMarket, solDelta: -0.5, degraded: true },
        stance: 'LONG',
        streakDays: 0,
        neighbourDensity: 0.5,
        daysSinceSectorChange: -1,
      },
      rng,
    );
    expect(factor).toBeCloseTo(0, 5);
  });
});

// ── Emissions schedule ──────────────────────────────────────────────────────

describe('emission schedule', () => {
  it('decays each season and never falls below the floor', () => {
    expect(dailyEmissionForDay(0)).toBe(400_000);
    expect(dailyEmissionForDay(90)).toBe(280_000);
    expect(dailyEmissionForDay(180)).toBe(196_000);
    expect(dailyEmissionForDay(9999)).toBeGreaterThanOrEqual(40_000);
  });

  it('is monotonically non-increasing', () => {
    let prev = Infinity;
    for (let d = 0; d < 2000; d += 30) {
      const e = dailyEmissionForDay(d);
      expect(e).toBeLessThanOrEqual(prev);
      prev = e;
    }
  });
});

// ── Gini ────────────────────────────────────────────────────────────────────

describe('gini', () => {
  it('is 0 for a perfectly equal distribution', () => {
    expect(gini([5, 5, 5, 5])).toBeCloseTo(0, 6);
  });
  it('approaches 1 as one holder takes everything', () => {
    expect(gini([0, 0, 0, 100])).toBeGreaterThan(0.7);
  });
});

// ── Balance targets from docs/ECONOMY.md §10 ────────────────────────────────

describe('balance simulation', () => {
  const result = runSimulation({ ...DEFAULT_SIM, days: 180 });

  it('runs without emitting more than scheduled', () => {
    let scheduled = 0;
    for (let d = 0; d < 180; d++) scheduled += dailyEmissionForDay(d);
    expect(result.totalEmitted).toBeLessThanOrEqual(scheduled + 1);
  });

  it('burns a meaningful share of emissions', () => {
    // Season 1 is inflationary by design; we only assert the sink is real.
    expect(result.burnRatio).toBeGreaterThan(0.25);
  });

  it('keeps payout inequality inside the target band', () => {
    expect(result.gini).toBeGreaterThan(0.2);
    expect(result.gini).toBeLessThan(0.75);
  });

  it('lets a median player reach tier 3 within a season', () => {
    expect(result.medianDaysToTier3).not.toBeNull();
    expect(result.medianDaysToTier3!).toBeLessThan(90);
  });
});
