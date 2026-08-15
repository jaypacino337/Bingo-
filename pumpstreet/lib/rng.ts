/**
 * Deterministic RNG.
 *
 * On-chain this is replaced by a VRF output (or a commit-reveal over a future
 * blockhash). Determinism matters for two reasons: settlement must be
 * independently verifiable by anyone replaying the day, and the balance
 * simulation must be reproducible.
 */

/** mulberry32 — small, fast, good enough distribution for game randomness. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive a stable per-plot seed from the day seed, so plots are independent. */
export function plotSeed(daySeed: number, plotId: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < plotId.length; i++) {
    h ^= plotId.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h ^ (daySeed >>> 0)) >>> 0;
}

/** Uniform in [-band, +band]. */
export function noise(rng: () => number, band: number): number {
  return (rng() * 2 - 1) * band;
}

/** Weighted pick from a {key: share} map. Shares need not be normalised. */
export function weightedPick<K extends string>(
  rng: () => number,
  shares: Record<K, number>,
): K {
  const keys = Object.keys(shares) as K[];
  const total = keys.reduce((s, k) => s + shares[k], 0);
  let r = rng() * total;
  for (const k of keys) {
    r -= shares[k];
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}
