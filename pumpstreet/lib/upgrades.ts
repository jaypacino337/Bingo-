import {
  CONDITION_MAX,
  LICENSE_COST_PUMPST,
  LOT_SIZE_TIER_CAP,
  PATH_CHANGE_COOLDOWN,
  REPAIR_COST_PER_POINT,
  REPAIR_COST_TIER_MULT,
  REZONING_FEE_SOL,
  STANCE_COOLDOWN,
  STANCE_LOCK_BEFORE_SETTLEMENT,
  TIERS,
} from './constants';
import type { Path, Plot, Sector, Stance } from './types';

/** A rejected action, with a reason the UI can show verbatim. */
export interface Denied {
  ok: false;
  reason: string;
}
export interface Allowed<T> {
  ok: true;
  cost: T;
}
export type Check<T> = Allowed<T> | Denied;

const deny = (reason: string): Denied => ({ ok: false, reason });

/** Highest tier this plot's land can ever support. */
export function maxTierFor(plot: Plot): number {
  return LOT_SIZE_TIER_CAP[plot.land.lotSize] ?? 2;
}

export interface UpgradeCost {
  pumpst: number;
  solFee: number;
  buildSeconds: number;
  toTier: number;
}

export function checkUpgrade(plot: Plot, now: number): Check<UpgradeCost> {
  const b = plot.building;
  const next = b.tier + 1;
  const cap = maxTierFor(plot);

  if (b.path === null) return deny('Choose a path before building.');
  if (next > cap) {
    return deny(
      `Lot size ${plot.land.lotSize} caps this plot at ${TIERS[cap].name} (tier ${cap}).`,
    );
  }
  if (b.cooldowns.buildUntil !== null && b.cooldowns.buildUntil > now) {
    return deny('Construction already in progress.');
  }
  if (isLeaseLocked(plot, now)) {
    return deny('Plot is under lease. Wait for the term to end.');
  }

  const spec = TIERS[next];
  return {
    ok: true,
    cost: {
      pumpst: spec.pumpstCost,
      solFee: spec.solFee,
      buildSeconds: spec.buildHours * 3600,
      toTier: next,
    },
  };
}

/**
 * Repair cost in PUMPST. Scales with damage *and* tier, so a neglected Tower is
 * genuinely expensive to bring back. This is the sink that never stops.
 */
export function repairCost(plot: Plot): number {
  const damage = CONDITION_MAX - plot.building.condition;
  if (damage <= 0) return 0;
  const tierMult = 1 + plot.building.tier * REPAIR_COST_TIER_MULT;
  return Math.ceil(damage * REPAIR_COST_PER_POINT * tierMult);
}

export function isLeaseLocked(plot: Plot, now: number): boolean {
  const { path, leaseEndsAt } = plot.building;
  return path === 'COMMERCIAL' && leaseEndsAt !== null && leaseEndsAt > now;
}

export interface PathChangeCost {
  solFee: number;
  pumpst: number;
  cooldownUntil: number;
}

export function checkPathChange(
  plot: Plot,
  to: Path,
  now: number,
  payRezoningFee: boolean,
): Check<PathChangeCost> {
  const b = plot.building;

  if (b.path === to) return deny('Plot is already on that path.');
  if (isLeaseLocked(plot, now)) {
    return deny('Plot is under lease. Wait for the term to end.');
  }
  if (b.cooldowns.buildUntil !== null && b.cooldowns.buildUntil > now) {
    return deny('Cannot rezone while construction is in progress.');
  }

  const onCooldown =
    b.cooldowns.pathChangeUntil !== null && b.cooldowns.pathChangeUntil > now;
  if (onCooldown && !payRezoningFee) {
    const hrs = Math.ceil((b.cooldowns.pathChangeUntil! - now) / 3600);
    return deny(`Rezoning cooldown: ${hrs}h remaining, or buy a permit.`);
  }

  return {
    ok: true,
    cost: {
      solFee: onCooldown ? REZONING_FEE_SOL : 0,
      // Switching into ENTERPRISE requires a business licence.
      pumpst: to === 'ENTERPRISE' ? LICENSE_COST_PUMPST : 0,
      cooldownUntil: now + PATH_CHANGE_COOLDOWN,
    },
  };
}

export function checkSectorChange(
  plot: Plot,
  _to: Sector,
  now: number,
): Check<{ pumpst: number }> {
  if (plot.building.path !== 'ENTERPRISE') {
    return deny('Only an enterprise can change sector.');
  }
  if (plot.building.cooldowns.buildUntil !== null && plot.building.cooldowns.buildUntil > now) {
    return deny('Cannot change sector during construction.');
  }
  return { ok: true, cost: { pumpst: LICENSE_COST_PUMPST } };
}

/**
 * Stance changes are cooled down *and* frozen before settlement, so nobody can
 * watch the candle and flip at the last second.
 */
export function checkStanceChange(
  plot: Plot,
  _to: Stance,
  now: number,
  nextSettlementAt: number,
): Check<Record<string, never>> {
  const b = plot.building;

  if (b.path !== 'ENTERPRISE') return deny('Only an enterprise takes a position.');
  if (b.sector === null) return deny('Pick a sector first.');

  if (nextSettlementAt - now <= STANCE_LOCK_BEFORE_SETTLEMENT) {
    const mins = Math.ceil((nextSettlementAt - now) / 60);
    return deny(`Positions are locked ${mins} minutes before settlement.`);
  }
  if (b.cooldowns.stanceUntil !== null && b.cooldowns.stanceUntil > now) {
    const mins = Math.ceil((b.cooldowns.stanceUntil - now) / 60);
    return deny(`Position cooldown: ${mins} minutes remaining.`);
  }

  return { ok: true, cost: {} };
}

export function stanceCooldownUntil(now: number): number {
  return now + STANCE_COOLDOWN;
}
