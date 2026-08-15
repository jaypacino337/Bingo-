import type { District, EventKind, Path, Sector } from './types';

/**
 * Tunables. Every gameplay number lives here so balance changes are one diff.
 * `simulate.ts` exists to check these against the targets in docs/ECONOMY.md.
 */

// ── Supply / mint ────────────────────────────────────────────────────────────

/** Phase 1 ("Genesis Block"). Phase 2 is gated on this clearing. */
export const PHASE_1_SUPPLY = 2000;
export const PHASE_1_PRICE_SOL = 0.15;

/** Phase 2 is optional and must not be minted unless Phase 1 sells through. */
export const PHASE_2_SUPPLY = 3000;
export const PHASE_2_PRICE_SOL = 0.22;

// ── Districts ────────────────────────────────────────────────────────────────

export const DISTRICT_WEIGHTS: Record<District, number> = {
  STRIP: 1.35,
  OLD_TOWN: 1.15,
  RIVERSIDE: 1.1,
  GRID: 1.0,
  WAREHOUSE: 0.95,
  OUTSKIRTS: 0.85,
};

/** Distribution used by the generator. Must sum to 1. */
export const DISTRICT_SHARES: Record<District, number> = {
  STRIP: 0.08,
  OLD_TOWN: 0.14,
  RIVERSIDE: 0.18,
  GRID: 0.3,
  WAREHOUSE: 0.2,
  OUTSKIRTS: 0.1,
};

/** Path each district favours — a small bonus, enough to change the correct play. */
export const DISTRICT_FAVOURS: Record<District, Path> = {
  STRIP: 'ENTERPRISE',
  OLD_TOWN: 'COMMERCIAL',
  RIVERSIDE: 'RESIDENTIAL',
  GRID: 'RESIDENTIAL',
  WAREHOUSE: 'ENTERPRISE',
  OUTSKIRTS: 'RESIDENTIAL',
};

export const DISTRICT_FAVOUR_BONUS = 0.08;

// ── Tiers ────────────────────────────────────────────────────────────────────

export interface TierSpec {
  name: string;
  pumpstCost: number;
  solFee: number;
  buildHours: number;
  weight: number;
}

export const TIERS: TierSpec[] = [
  // Weights are deliberately compressed rather than exponential. An uncompressed
  // curve (0.5/1/1.6/2.5/3.8/5.5) pushed the payout Gini to 0.71 in simulation —
  // oligarchic, and it makes a small lot feel pointless forever. Costs are tuned
  // so a median player reaches tier 3 in ~30 days. Re-run the sim after touching
  // any of these.
  { name: 'Empty Lot', pumpstCost: 0, solFee: 0, buildHours: 0, weight: 0.6 },
  { name: 'Shack', pumpstCost: 800, solFee: 0.002, buildHours: 2, weight: 1.0 },
  { name: 'House', pumpstCost: 2_800, solFee: 0.004, buildHours: 8, weight: 1.45 },
  { name: 'Building', pumpstCost: 9_500, solFee: 0.008, buildHours: 24, weight: 2.0 },
  { name: 'Complex', pumpstCost: 30_000, solFee: 0.015, buildHours: 48, weight: 2.7 },
  { name: 'Tower', pumpstCost: 85_000, solFee: 0.03, buildHours: 96, weight: 3.5 },
];

export const MAX_TIER = TIERS.length - 1;

/** lotSize → max reachable tier. Only size-4 lots can ever hold a Tower. */
export const LOT_SIZE_TIER_CAP: Record<number, number> = { 1: 2, 2: 3, 3: 4, 4: 5 };

/** Lot size distribution. Size 4 is deliberately rare — permanent scarcity. */
export const LOT_SIZE_SHARES: Record<number, number> = {
  1: 0.34,
  2: 0.38,
  3: 0.22,
  4: 0.06,
};

// ── Condition ────────────────────────────────────────────────────────────────

export const CONDITION_MAX = 100;
export const CONDITION_DECAY_BASE = 1.2;
export const CONDITION_DECAY_PER_TIER = 0.3;
/** Below this, weight starts scaling down linearly to zero. */
export const CONDITION_HEALTHY_FLOOR = 60;
/** PUMPST cost to repair one condition point at tier t. */
/**
 * Repair is the perpetual sink — it keeps burning long after everyone has
 * finished upgrading. Tuned upward so burns keep pace with emissions once the
 * street is built out.
 */
export const REPAIR_COST_PER_POINT = 95;
export const REPAIR_COST_TIER_MULT = 0.6;

// ── Paths ────────────────────────────────────────────────────────────────────

export const PATH_BASE_MULT: Record<Path, number> = {
  RESIDENTIAL: 1.0,
  COMMERCIAL: 1.15,
  ENTERPRISE: 1.0,
};

export const RESIDENTIAL_NOISE = 0.03;

/** Commercial multiplier by lease term. Longer lock, better rate. */
export const LEASE_TERM_MULT: Record<number, number> = { 7: 1.15, 14: 1.28, 30: 1.45 };
/** Fraction of the sector's swing a landlord absorbs. */
export const COMMERCIAL_DAMPING = 0.35;
export const COMMERCIAL_DEFAULT_CHANCE = 0.04;

/** Enterprise weight is clamped to this band, whatever the market does. */
export const ENTERPRISE_FLOOR = 0.7;
export const ENTERPRISE_CEILING = 2.2;
/** Debt is capped at this many days of the plot's own average yield. */
export const ENTERPRISE_DEBT_CAP_DAYS = 3;

// ── Sectors ──────────────────────────────────────────────────────────────────

export interface SectorSpec {
  directional: boolean;
  /** How hard the driver moves the index. */
  beta: number;
  /** Baseline return when the driver is flat. */
  base: number;
  /** Random noise band. */
  noise: number;
}

export const SECTORS: Record<Sector, SectorSpec> = {
  HEDGE_FUND: { directional: true, beta: 9.0, base: 0.0, noise: 0.18 },
  PROP_DESK: { directional: true, beta: 6.0, base: 0.02, noise: 0.12 },
  CASINO: { directional: false, beta: 0.0, base: -0.35, noise: 0.25 },
  NIGHTCLUB: { directional: false, beta: 0.0, base: 0.0, noise: 0.3 },
  TECH_STARTUP: { directional: false, beta: 0.0, base: -0.45, noise: 0.2 },
  DELI: { directional: false, beta: 0.0, base: 0.05, noise: 0.06 },
  GYM: { directional: false, beta: 0.0, base: 0.0, noise: 0.12 },
  BARBERSHOP: { directional: false, beta: 0.0, base: 0.04, noise: 0.05 },
};

export const CASINO_JACKPOT_CHANCE = 0.08;
export const CASINO_JACKPOT_MULT = 6.0;
export const STARTUP_EXIT_CHANCE = 0.004;
export const STARTUP_EXIT_MULT = 40.0;
export const BARBERSHOP_STREAK_BONUS_PER_DAY = 0.004;
export const BARBERSHOP_STREAK_CAP = 0.25;

// ── Events ───────────────────────────────────────────────────────────────────

export const EVENT_CHANCES: Record<EventKind, number> = {
  BLOCK_PARTY: 0.03,
  HEALTH_INSPECTOR: 0.02,
  BURST_PIPE: 0.02,
  CELEBRITY: 0.008,
  RENT_STRIKE: 0.015,
  VIRAL_MOMENT: 0.005,
  GRAND_OPENING: 0.012,
  PERMIT_AUDIT: 0.01,
};

// ── Emissions ────────────────────────────────────────────────────────────────

export const SEASON_DAYS = 90;
export const SEASON_1_DAILY = 400_000;
export const SEASON_DECAY = 0.7;
export const EMISSION_FLOOR = 40_000;

// ── Cooldowns (seconds) ──────────────────────────────────────────────────────

export const PATH_CHANGE_COOLDOWN = 7 * 24 * 3600;
export const STANCE_COOLDOWN = 6 * 3600;
/** Stance is frozen this long before settlement so nobody front-runs the candle. */
export const STANCE_LOCK_BEFORE_SETTLEMENT = 2 * 3600;
export const UNSTAKE_COOLDOWN = 24 * 3600;

// ── Fees (SOL, protocol revenue) ─────────────────────────────────────────────

// ── Property tax ─────────────────────────────────────────────────────────────

/**
 * Property tax, taken as a share of *gross* daily yield and burned.
 *
 * Expressed as a percentage of yield rather than a flat fee on purpose:
 *  - It can never bankrupt a player, so nobody is taxed off the street.
 *  - It scales automatically with tier, district and emission schedule.
 *  - It structurally guarantees burns >= TAX_RATE x emissions, forever, which
 *    is what keeps the economy solvent once players hit their lot-size tier cap
 *    and stop buying upgrades. Without this the burn ratio collapses; see the
 *    simulation note in docs/ECONOMY.md §10.
 */
export const TAX_RATE_ON_YIELD = 0.3;

/**
 * Progressive tax brackets by building tier.
 *
 * A flat tax left two documented targets missed: the burn ratio sat at 0.52
 * against a 0.70 goal, and the payout Gini at 0.71 against 0.55. Brackets fix
 * both with one mechanic — bigger buildings pay a higher rate, which compresses
 * net payouts (lowering Gini) while raising total burn (lifting the ratio).
 *
 * It is also the thematically correct answer: property tax has always had
 * brackets. Effective rate = TAX_RATE_ON_YIELD x bracket x district multiplier,
 * capped at 90% so no plot ever nets zero.
 */
export const TIER_TAX_BRACKET: number[] = [1.0, 1.0, 1.25, 1.5, 1.75, 2.0];

/**
 * District tax modifiers. The expensive districts are taxed harder, which is
 * what stops them being strictly better — a cheap Outskirts plot keeps more of
 * what it earns.
 */
export const DISTRICT_TAX_MULT: Record<District, number> = {
  STRIP: 1.4,
  OLD_TOWN: 1.1,
  RIVERSIDE: 1.0,
  GRID: 1.0,
  WAREHOUSE: 0.9,
  OUTSKIRTS: 0.7,
};

export const REZONING_FEE_SOL = 0.05;
export const LICENSE_COST_PUMPST = 2_500;
export const LANDMARK_WEIGHT_BONUS = 0.25;
export const CORNER_LOT_WEIGHT_BONUS = 0.08;
