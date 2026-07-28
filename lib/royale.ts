/**
 * Duel Royale — deterministic resolution.
 *
 * IMPORTANT: mirrored byte-for-byte from server/src/royale.ts so the browser
 * can replay a settled round from the revealed seed and check it was not
 * rigged. If you change it, copy it across:
 *
 *   cp server/src/royale.ts lib/royale.ts
 *
 * The whole round — every elimination and every duel — is decided up front by
 * shuffling the fighters into a secret ranking. Rank 0 is the champion. Waves
 * then cut from the bottom of that ranking, and duels are resolved by "better
 * rank wins". Nothing is decided while the round is playing, so the result can
 * be recomputed from the seed alone, and nothing can be nudged mid-game.
 */

/** How many fighters survive the culling and go through to the duels. */
export const FINALISTS = 8;

export interface Fighter {
  wallet: string;
  /** Which of that wallet's entries this is. */
  entry: number;
}

export interface Duel {
  /** Bracket round: 0 = quarter-finals, then semis, then the final. */
  round: number;
  a: Fighter | null;
  b: Fighter | null;
  winner: Fighter | null;
}

export interface RoyaleResult {
  /** Every fighter, best first. Index 0 is the champion. */
  ranking: Fighter[];
  /** Fighters knocked out in each culling wave, in order. */
  waves: Fighter[][];
  /** The survivors who reach the duels. */
  finalists: Fighter[];
  /** Duels in playing order, quarters through to the final. */
  duels: Duel[];
  champion: Fighter | null;
}

// ---------------------------------------------------------------------------
// PRNG — same xmur3 + sfc32 pair used for the draw ordering elsewhere.
// ---------------------------------------------------------------------------

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export function rng(seed: string): () => number {
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function fighterId(fighter: Fighter): string {
  return `${fighter.wallet}:${fighter.entry}`;
}

// ---------------------------------------------------------------------------
// Bracket
// ---------------------------------------------------------------------------

/**
 * Standard tournament seeding, so the two strongest seeds can only meet in the
 * final: for 8 that is 1v8, 4v5, 2v7, 3v6.
 */
function seedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const round = order.length * 2;
    const next: number[] = [];
    for (const seed of order) {
      next.push(seed, round - 1 - seed);
    }
    order = next;
  }
  return order;
}

function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * Builds every duel, in playing order. Fighters are seeded by rank, so a
 * higher-ranked fighter always beats a lower-ranked one — the ranking is the
 * single source of truth for the whole round.
 */
function buildDuels(finalists: Fighter[], rankOf: Map<string, number>): Duel[] {
  if (finalists.length < 2) return [];

  const size = nextPowerOfTwo(finalists.length);
  const order = seedOrder(size);
  // Slots hold a fighter or null for a bye.
  const slots: (Fighter | null)[] = order.map((seed) => finalists[seed] ?? null);

  const duels: Duel[] = [];
  let current = slots;
  let round = 0;

  while (current.length > 1) {
    const next: (Fighter | null)[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i] ?? null;
      const b = current[i + 1] ?? null;

      let winner: Fighter | null;
      if (a && b) {
        // Better rank (lower number) wins.
        winner = (rankOf.get(fighterId(a)) ?? 1e9) < (rankOf.get(fighterId(b)) ?? 1e9) ? a : b;
      } else {
        winner = a ?? b;
      }

      // A bye is not a duel — nobody wants to watch someone walk over.
      if (a && b) duels.push({ round, a, b, winner });
      next.push(winner);
    }
    current = next;
    round++;
  }

  return duels;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function resolveRoyale(serverSeed: string, fighters: Fighter[]): RoyaleResult {
  if (fighters.length === 0) {
    return { ranking: [], waves: [], finalists: [], duels: [], champion: null };
  }

  // The secret ranking. Everything else is a view onto it.
  const ranking = shuffle(fighters, rng(`royale:${serverSeed}`));
  const rankOf = new Map<string, number>();
  ranking.forEach((fighter, index) => rankOf.set(fighterId(fighter), index));

  // Cull from the bottom, roughly halving each wave, until the finalists remain.
  const waves: Fighter[][] = [];
  let alive = ranking.slice();
  while (alive.length > FINALISTS) {
    const target = Math.max(FINALISTS, Math.ceil(alive.length / 2));
    waves.push(alive.slice(target));
    alive = alive.slice(0, target);
  }

  const finalists = alive;
  const duels = buildDuels(finalists, rankOf);

  return { ranking, waves, finalists, duels, champion: ranking[0] ?? null };
}

/** Total steps in a round, for progress display. */
export function roundLength(result: RoyaleResult): number {
  return result.waves.length + result.duels.length;
}
