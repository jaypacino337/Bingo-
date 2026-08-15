'use client';

import { useMemo, useState } from 'react';
import {
  DISTRICT_TAX_MULT,
  PHASE_1_PRICE_SOL,
  PHASE_1_SUPPLY,
  TIERS,
} from '@/pumpstreet/lib/constants';
import { generateCollection } from '@/pumpstreet/lib/plots';
import { settleDay } from '@/pumpstreet/lib/yield';
import type {
  District,
  MarketTick,
  Path,
  Plot,
  Sector,
  Stance,
} from '@/pumpstreet/lib/types';

const COLLECTION_SEED = 20260815;
const PREVIEW_PLOTS = 240;

const DISTRICT_LABEL: Record<District, string> = {
  STRIP: 'The Strip',
  OLD_TOWN: 'Old Town',
  RIVERSIDE: 'Riverside',
  GRID: 'The Grid',
  WAREHOUSE: 'Warehouse Row',
  OUTSKIRTS: 'Outskirts',
};

const DISTRICT_DOT: Record<District, string> = {
  STRIP: 'bg-pump-300',
  OLD_TOWN: 'bg-pump-500',
  RIVERSIDE: 'bg-emerald-400',
  GRID: 'bg-forest-500',
  WAREHOUSE: 'bg-amber-500',
  OUTSKIRTS: 'bg-forest-600',
};

const PATHS: { id: Path; name: string; blurb: string; risk: string }[] = [
  {
    id: 'RESIDENTIAL',
    name: 'Residential',
    blurb: 'Rent to tenants. Steady, no market exposure.',
    risk: 'Low',
  },
  {
    id: 'COMMERCIAL',
    name: 'Commercial',
    blurb: 'Lease to a business. Locked term, dampened swings.',
    risk: 'Medium',
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    blurb: 'Run it yourself. Full exposure, can go into debt.',
    risk: 'High',
  },
];

const SECTORS: { id: Sector; name: string; driver: string; directional: boolean }[] = [
  { id: 'HEDGE_FUND', name: 'Hedge Fund', driver: 'SOL/USD 24h', directional: true },
  { id: 'PROP_DESK', name: 'Prop Desk', driver: 'BTC/USD 24h', directional: true },
  { id: 'CASINO', name: 'Casino', driver: 'Pure RNG', directional: false },
  { id: 'NIGHTCLUB', name: 'Nightclub', driver: 'Weekend + activity', directional: false },
  { id: 'TECH_STARTUP', name: 'Tech Startup', driver: 'Exit lottery', directional: false },
  { id: 'DELI', name: 'Deli', driver: 'Inverse volatility', directional: false },
  { id: 'GYM', name: 'Gym', driver: 'Neighbour density', directional: false },
  { id: 'BARBERSHOP', name: 'Barbershop', driver: 'Staking streak', directional: false },
];

const SCENARIOS: { id: string; label: string; solDelta: number; vol: number }[] = [
  { id: 'crash', label: 'SOL −12%', solDelta: -0.12, vol: 0.9 },
  { id: 'down', label: 'SOL −4%', solDelta: -0.04, vol: 0.5 },
  { id: 'flat', label: 'Flat', solDelta: 0.0, vol: 0.15 },
  { id: 'up', label: 'SOL +4%', solDelta: 0.04, vol: 0.5 },
  { id: 'rip', label: 'SOL +12%', solDelta: 0.12, vol: 0.9 },
];

function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export default function StreetClient() {
  const [selected, setSelected] = useState(1);
  const [path, setPath] = useState<Path>('ENTERPRISE');
  const [sector, setSector] = useState<Sector>('HEDGE_FUND');
  const [stance, setStance] = useState<Stance>('LONG');
  const [tier, setTier] = useState(2);
  const [scenario, setScenario] = useState('crash');

  // The whole street, generated deterministically from the published seed.
  const street = useMemo(
    () => generateCollection(PREVIEW_PLOTS, COLLECTION_SEED),
    [],
  );

  const plot = street[selected - 1];
  const maxTier = { 1: 2, 2: 3, 3: 4, 4: 5 }[plot.land.lotSize] ?? 2;
  const effectiveTier = Math.min(tier, maxTier);
  const activeSector = PATHS.find((p) => p.id === path);
  const sectorSpec = SECTORS.find((s) => s.id === sector)!;
  const showStance = path === 'ENTERPRISE' && sectorSpec.directional;

  /**
   * Run the *real* settlement engine across every scenario. The street around
   * you is populated so weight competition is realistic — your slice depends on
   * everyone else, exactly as it does on-chain.
   */
  const results = useMemo(() => {
    const populated: Plot[] = street.map((p, i) => {
      if (p.land.plotNumber === selected) {
        return {
          ...p,
          building: {
            ...p.building,
            staked: true,
            path,
            tier: effectiveTier,
            sector: path === 'RESIDENTIAL' ? null : sector,
            stance: showStance ? stance : null,
            leaseTermDays: path === 'COMMERCIAL' ? 14 : null,
            tenantQuality: path === 'COMMERCIAL' ? 70 : null,
          },
        };
      }
      // Neighbours: a plausible mix so total weight is realistic.
      const mixPath: Path =
        i % 5 === 0 ? 'ENTERPRISE' : i % 3 === 0 ? 'COMMERCIAL' : 'RESIDENTIAL';
      return {
        ...p,
        building: {
          ...p.building,
          staked: i % 10 !== 0,
          path: mixPath,
          tier: 1 + (i % 3),
          sector: mixPath === 'RESIDENTIAL' ? null : 'DELI',
          leaseTermDays: mixPath === 'COMMERCIAL' ? 14 : null,
          tenantQuality: mixPath === 'COMMERCIAL' ? 60 : null,
        },
      };
    });

    return SCENARIOS.map((s) => {
      const market: MarketTick = {
        timestamp: 1_760_000_000,
        solDelta: s.solDelta,
        btcDelta: s.solDelta * 0.6,
        volatility: s.vol,
        networkActivity: 0.55,
        degraded: false,
      };
      const out = settleDay({
        plots: populated,
        market,
        dailyEmission: 400_000,
        seed: 7,
      });
      const mine = out.settlements.find((x) => x.plotId === plot.id);
      return { scenario: s, mine, total: out.totalWeight };
    });
  }, [street, selected, path, sector, stance, effectiveTier, showStance, plot.id]);

  const current = results.find((r) => r.scenario.id === scenario)!;
  const best = Math.max(...results.map((r) => r.mine?.payout ?? 0));
  const taxRate = 0.4 * DISTRICT_TAX_MULT[plot.land.district];

  return (
    <div className="min-h-screen bg-forest-950 text-mint-50">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-forest-700/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow-on-dark">Genesis Block · Phase 1</p>
            <h1 className="mt-2 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
              Pump Street
            </h1>
            <p className="mt-2 max-w-xl text-sm text-mint-200/70">
              {fmt(PHASE_1_SUPPLY)} plots. Pick how you use yours. The street pays a
              fixed budget every day — you compete for a share of it.
            </p>
          </div>
          <div className="shrink-0 rounded-xl border-2 border-forest-600 bg-forest-900 px-5 py-4">
            <p className="font-mono text-[11px] uppercase tracking-label text-pump-400">
              Mint price
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-pump-300">
              {PHASE_1_PRICE_SOL} SOL
            </p>
            <p className="font-mono text-[11px] text-mint-200/50">≈ $11.34 at $75.60</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[320px_1fr]">
        {/* ── Street map ───────────────────────────────────────────────── */}
        <section>
          <h2 className="eyebrow-on-dark">The street</h2>
          <p className="mt-1 mb-4 text-xs text-mint-200/60">
            Generated from seed{' '}
            <span className="font-mono text-pump-400">{COLLECTION_SEED}</span> — publish
            it and anyone can verify the rare lots weren&apos;t handed to insiders.
          </p>

          <div className="grid grid-cols-12 gap-1">
            {street.map((p) => {
              const isSel = p.land.plotNumber === selected;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.land.plotNumber)}
                  title={`#${p.land.plotNumber} · ${DISTRICT_LABEL[p.land.district]} · lot ${p.land.lotSize}`}
                  className={`aspect-square rounded-[3px] transition ${
                    DISTRICT_DOT[p.land.district]
                  } ${
                    isSel
                      ? 'scale-125 ring-2 ring-pump-200'
                      : 'opacity-60 hover:opacity-100'
                  } ${p.land.landmark ? 'ring-1 ring-amber-300' : ''}`}
                />
              );
            })}
          </div>

          <ul className="mt-5 space-y-1.5">
            {(Object.keys(DISTRICT_LABEL) as District[]).map((d) => (
              <li key={d} className="flex items-center gap-2 text-xs text-mint-200/70">
                <span className={`h-2.5 w-2.5 rounded-[2px] ${DISTRICT_DOT[d]}`} />
                {DISTRICT_LABEL[d]}
                <span className="ml-auto font-mono text-[11px] text-mint-200/40">
                  tax ×{DISTRICT_TAX_MULT[d].toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Plot configurator ────────────────────────────────────────── */}
        <section className="space-y-6">
          {/* Land facts */}
          <div className="rounded-2xl border-2 border-forest-700 bg-forest-900 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-bold">
                Plot #{plot.land.plotNumber}
                {plot.land.landmark && (
                  <span className="ml-2 rounded bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-label text-amber-300">
                    Landmark
                  </span>
                )}
              </h2>
              <p className="font-mono text-xs text-mint-200/60">
                {DISTRICT_LABEL[plot.land.district]}
              </p>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Lot size', `${plot.land.lotSize} / 4`],
                ['Max tier', TIERS[maxTier].name],
                ['Frontage', `${plot.land.frontage} / 3`],
                ['Corner', plot.land.cornerLot ? 'Yes' : 'No'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-forest-800 px-3 py-2">
                  <dt className="font-mono text-[10px] uppercase tracking-label text-pump-400">
                    {k}
                  </dt>
                  <dd className="mt-0.5 text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            {maxTier < 5 && (
              <p className="mt-3 text-xs text-mint-200/50">
                This lot can never exceed{' '}
                <span className="text-pump-300">{TIERS[maxTier].name}</span>. Land
                scarcity is permanent — only ~6% of plots can hold a Tower.
              </p>
            )}
          </div>

          {/* Path */}
          <div>
            <h3 className="eyebrow-on-dark mb-3">1 · Choose a path</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {PATHS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPath(p.id)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    path === p.id
                      ? 'border-pump-400 bg-forest-800'
                      : 'border-forest-700 bg-forest-900 hover:border-forest-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{p.name}</span>
                    <span className="font-mono text-[10px] uppercase tracking-label text-mint-200/50">
                      {p.risk}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-mint-200/60">{p.blurb}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Sector */}
          {path !== 'RESIDENTIAL' && (
            <div>
              <h3 className="eyebrow-on-dark mb-3">
                2 · {path === 'COMMERCIAL' ? 'Tenant sector' : 'Your business'}
              </h3>
              <div className="grid gap-2 sm:grid-cols-4">
                {SECTORS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSector(s.id)}
                    className={`rounded-lg border-2 px-3 py-2 text-left transition ${
                      sector === s.id
                        ? 'border-pump-400 bg-forest-800'
                        : 'border-forest-700 bg-forest-900 hover:border-forest-600'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{s.name}</span>
                    <span className="font-mono text-[10px] text-mint-200/50">
                      {s.driver}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stance */}
          {showStance && (
            <div>
              <h3 className="eyebrow-on-dark mb-3">3 · Take a position</h3>
              <div className="flex gap-2">
                {(['LONG', 'SHORT'] as Stance[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStance(s)}
                    className={`flex-1 rounded-xl border-2 py-3 font-bold uppercase tracking-[0.08em] transition ${
                      stance === s
                        ? s === 'LONG'
                          ? 'border-pump-400 bg-pump-500/15 text-pump-300'
                          : 'border-red-400 bg-red-500/15 text-red-300'
                        : 'border-forest-700 bg-forest-900 text-mint-200/60 hover:border-forest-600'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-mint-200/50">
                Locked 2h before settlement, 6h cooldown — you can&apos;t watch the
                candle and flip.
              </p>
            </div>
          )}

          {/* Tier */}
          <div>
            <h3 className="eyebrow-on-dark mb-3">Build tier</h3>
            <div className="flex flex-wrap gap-2">
              {TIERS.map((t, i) => {
                const locked = i > maxTier;
                return (
                  <button
                    key={t.name}
                    disabled={locked}
                    onClick={() => setTier(i)}
                    className={`rounded-lg border-2 px-3 py-2 text-xs transition ${
                      locked
                        ? 'cursor-not-allowed border-forest-800 bg-forest-900/50 text-mint-200/25'
                        : effectiveTier === i
                          ? 'border-pump-400 bg-forest-800'
                          : 'border-forest-700 bg-forest-900 hover:border-forest-600'
                    }`}
                  >
                    <span className="block font-semibold">{t.name}</span>
                    <span className="font-mono text-[10px] text-mint-200/50">
                      {t.pumpstCost ? `${fmt(t.pumpstCost)} PST` : 'free'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Outcome ────────────────────────────────────────────────── */}
          <div className="rounded-2xl border-2 border-forest-600 bg-forest-900 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="eyebrow-on-dark">Daily settlement</h3>
              <div className="flex flex-wrap gap-1">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScenario(s.id)}
                    className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition ${
                      scenario === s.id
                        ? 'bg-pump-500 text-forest-950'
                        : 'bg-forest-800 text-mint-200/60 hover:text-mint-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-label text-pump-400">
                  Net payout
                </p>
                <p className="mt-1 font-mono text-3xl font-bold text-pump-300">
                  {fmt(current.mine?.payout ?? 0)}
                </p>
                <p className="font-mono text-[11px] text-mint-200/50">PUMPST / day</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-label text-pump-400">
                  Gross → tax
                </p>
                <p className="mt-1 font-mono text-lg">
                  {fmt(current.mine?.gross ?? 0)}
                </p>
                <p className="font-mono text-[11px] text-red-300/70">
                  −{fmt(current.mine?.taxPaid ?? 0)} burned ({(taxRate * 100).toFixed(0)}%)
                </p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-label text-pump-400">
                  Weight share
                </p>
                <p className="mt-1 font-mono text-lg">
                  {current.total > 0
                    ? (((current.mine?.weight ?? 0) / current.total) * 100).toFixed(3)
                    : '0.000'}
                  %
                </p>
                <p className="font-mono text-[11px] text-mint-200/50">
                  of {fmt(current.total, 1)} total
                </p>
              </div>
            </div>

            {/* Scenario bars */}
            <div className="mt-6 space-y-2">
              {results.map((r) => {
                const pay = r.mine?.payout ?? 0;
                const pct = best > 0 ? (pay / best) * 100 : 0;
                const isDown = r.scenario.solDelta < 0;
                return (
                  <div key={r.scenario.id} className="flex items-center gap-3">
                    <span className="w-20 shrink-0 font-mono text-[11px] text-mint-200/60">
                      {r.scenario.label}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-forest-800">
                      <div
                        className={`h-full rounded transition-all ${
                          isDown && path === 'ENTERPRISE' && sectorSpec.directional
                            ? stance === 'LONG'
                              ? 'bg-red-500/70'
                              : 'bg-pump-500'
                            : 'bg-pump-600'
                        }`}
                        style={{ width: `${Math.max(1.5, pct)}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right font-mono text-[11px]">
                      {fmt(pay)}
                    </span>
                  </div>
                );
              })}
            </div>

            {current.mine && current.mine.marketFactor < -0.5 && (
              <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                Bad day. Your position went the wrong way — at higher tiers this puts
                you into debt against future emissions, capped at 3 days of yield.
              </p>
            )}

            {path === 'RESIDENTIAL' && (
              <p className="mt-4 rounded-lg border border-forest-600 bg-forest-800/60 px-3 py-2 text-xs text-mint-200/70">
                Residential ignores the market entirely. Same payout in a crash as in a
                rip — that&apos;s what you trade the ceiling for.
              </p>
            )}
          </div>

          <p className="text-xs leading-relaxed text-mint-200/40">
            Figures come from the same settlement engine that runs on-chain
            (<span className="font-mono">pumpstreet/lib/yield.ts</span>), against a
            populated street. They are illustrative of the mechanics, not a forecast,
            and not a promise of any return. Emissions are a fixed daily budget: your
            payout is a share of it, so it moves with what everyone else on the street
            does.
          </p>
        </section>
      </main>
    </div>
  );
}
