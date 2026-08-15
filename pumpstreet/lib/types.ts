/**
 * Pump Street — core domain types.
 *
 * Every number here is a tunable. Nothing in this file promises a return.
 */

export type District =
  | 'STRIP'
  | 'OLD_TOWN'
  | 'RIVERSIDE'
  | 'GRID'
  | 'WAREHOUSE'
  | 'OUTSKIRTS';

export type Path = 'RESIDENTIAL' | 'COMMERCIAL' | 'ENTERPRISE';

export type Sector =
  | 'HEDGE_FUND'
  | 'PROP_DESK'
  | 'CASINO'
  | 'NIGHTCLUB'
  | 'TECH_STARTUP'
  | 'DELI'
  | 'GYM'
  | 'BARBERSHOP';

export type Stance = 'LONG' | 'SHORT';

export type EventKind =
  | 'BLOCK_PARTY'
  | 'HEALTH_INSPECTOR'
  | 'BURST_PIPE'
  | 'CELEBRITY'
  | 'RENT_STRIKE'
  | 'VIRAL_MOMENT'
  | 'GRAND_OPENING'
  | 'PERMIT_AUDIT';

/** Immutable land attributes, fixed at mint. */
export interface Land {
  plotNumber: number;
  district: District;
  /** 1..4 — caps the maximum building tier. */
  lotSize: 1 | 2 | 3 | 4;
  /** 1..3 — foot traffic, multiplies the COMMERCIAL path. */
  frontage: 1 | 2 | 3;
  cornerLot: boolean;
  landmark: boolean;
  /** Block id, used for neighbour effects and BLOCK_PARTY. */
  block: number;
}

/** Mutable building/business state. */
export interface Building {
  path: Path | null;
  tier: number; // 0..5
  /** 0..100. Decays daily; low condition slashes weight. */
  condition: number;
  sector: Sector | null;
  stance: Stance | null;
  /** Unix seconds. COMMERCIAL only — plot is locked until this passes. */
  leaseEndsAt: number | null;
  /** Lease term in days, drives the commercial multiplier. */
  leaseTermDays: 7 | 14 | 30 | null;
  /** 0..100, rolled at lease signing. */
  tenantQuality: number | null;
  staked: boolean;
  /** Consecutive days staked without interruption. */
  streakDays: number;
  /** Negative balance owed against future emissions (ENTERPRISE only). */
  debt: number;
  cooldowns: {
    /** Unix seconds until the in-progress build completes. */
    buildUntil: number | null;
    pathChangeUntil: number | null;
    stanceUntil: number | null;
    unstakeUntil: number | null;
  };
}

export interface Plot {
  id: string;
  land: Land;
  building: Building;
  owner: string;
}

/** One UTC day of market inputs, read at settlement. */
export interface MarketTick {
  /** Unix seconds of the settlement boundary. */
  timestamp: number;
  /** Fractional 24h change, e.g. -0.062 for -6.2%. */
  solDelta: number;
  btcDelta: number;
  /** Realised volatility proxy, 0..1+. Drives the DELI (inverse). */
  volatility: number;
  /** 0..1 network activity proxy, drives the NIGHTCLUB. */
  networkActivity: number;
  /** True if Pyth confidence was too wide — day voids to neutral. */
  degraded: boolean;
}

export interface PlotEvent {
  kind: EventKind;
  /** Multiplicative modifier applied to weight for this settlement. */
  weightMod: number;
  /** Immediate condition delta, if any. */
  conditionDelta: number;
  note: string;
}

export interface SettlementInput {
  plots: Plot[];
  market: MarketTick;
  /** Total PUMPST to distribute this day. */
  dailyEmission: number;
  /** Deterministic seed — in production, a VRF output. */
  seed: number;
}

export interface PlotSettlement {
  plotId: string;
  weight: number;
  /** Share of the day's emission, after tax and debt repayment. */
  payout: number;
  /** Gross share before tax and debt were deducted. */
  gross: number;
  /** Property tax taken from gross and burned. */
  taxPaid: number;
  debtRepaid: number;
  debtIncurred: number;
  events: PlotEvent[];
  marketFactor: number;
  conditionAfter: number;
}

export interface SettlementResult {
  day: number;
  totalWeight: number;
  emitted: number;
  /** Total property tax burned this settlement. */
  taxBurned: number;
  /** Emission that went unclaimed because no plots were staked. */
  unallocated: number;
  settlements: PlotSettlement[];
}
