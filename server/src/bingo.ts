/**
 * Deterministic bingo primitives.
 *
 * IMPORTANT: this file is mirrored byte-for-byte from server/src/bingo.ts.
 * The browser regenerates cards locally from (wallet, cardIndex) instead of
 * downloading them, so both copies must stay in sync. If you change the card
 * generator, copy the file across:
 *
 *   cp server/src/bingo.ts lib/bingo.ts
 */

export type WinPattern = 'line' | 'x' | 'full';

/** A card is 5 columns of 5 numbers. `null` is the free center square. */
export type Card = (number | null)[][];

export const COLUMN_LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;

/** Inclusive number range for each column: B 1-15, I 16-30, ... */
export const COLUMN_RANGES: [number, number][] = [
  [1, 15],
  [16, 30],
  [31, 45],
  [46, 60],
  [61, 75],
];

// ---------------------------------------------------------------------------
// PRNG — xmur3 seeding + sfc32. Small, fast, and identical across JS runtimes.
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

/** Seeded [0,1) generator. Same seed string => same sequence, everywhere. */
export function rng(seed: string): () => number {
  const h = xmur3(seed);
  return sfc32(h(), h(), h(), h());
}

/** Fisher-Yates using a seeded generator. Does not mutate the input. */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
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

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/**
 * Build the card a wallet owns at a given index. Deterministic: the same
 * wallet always sees the same cards, in every round, on every device.
 */
export function generateCard(wallet: string, cardIndex: number): Card {
  const random = rng(`bingo-card:${wallet.trim()}:${cardIndex}`);
  const card: Card = [];

  for (let col = 0; col < 5; col++) {
    const range = COLUMN_RANGES[col] as [number, number];
    const pool: number[] = [];
    for (let n = range[0]; n <= range[1]; n++) pool.push(n);

    const picked = shuffle(pool, random).slice(0, 5) as number[];
    // Center square (column N, row 2) is free.
    const column: (number | null)[] = col === 2
      ? [picked[0]!, picked[1]!, null, picked[3]!, picked[4]!]
      : picked;
    card.push(column);
  }

  return card;
}

export function generateCards(wallet: string, count: number): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) cards.push(generateCard(wallet, i));
  return cards;
}

/** Every number on a card, free square excluded. */
export function cardNumbers(card: Card): number[] {
  const out: number[] = [];
  for (const col of card) for (const n of col) if (n !== null) out.push(n);
  return out;
}

// ---------------------------------------------------------------------------
// Win detection
// ---------------------------------------------------------------------------

/** true when the square at [col][row] is daubed (drawn, or the free centre). */
export function isDaubed(card: Card, col: number, row: number, drawn: ReadonlySet<number>): boolean {
  const value = card[col]?.[row];
  if (value === undefined) return false;
  if (value === null) return true; // free square
  return drawn.has(value);
}

/**
 * All winning lines for the given pattern, as [col, row] coordinate lists.
 *  - line: 5 rows + 5 columns + 2 diagonals
 *  - x:    the two diagonals (both must be complete)
 *  - full: blackout, every square
 */
export function winningLines(patternName: WinPattern): [number, number][][] {
  const rows: [number, number][][] = [];
  for (let row = 0; row < 5; row++) {
    rows.push([0, 1, 2, 3, 4].map((col) => [col, row] as [number, number]));
  }
  const cols: [number, number][][] = [];
  for (let col = 0; col < 5; col++) {
    cols.push([0, 1, 2, 3, 4].map((row) => [col, row] as [number, number]));
  }
  const diagA: [number, number][] = [0, 1, 2, 3, 4].map((i) => [i, i] as [number, number]);
  const diagB: [number, number][] = [0, 1, 2, 3, 4].map((i) => [i, 4 - i] as [number, number]);

  switch (patternName) {
    case 'line':
      return [...rows, ...cols, diagA, diagB];
    case 'x':
      return [diagA, diagB];
    case 'full': {
      const all: [number, number][] = [];
      for (let col = 0; col < 5; col++) for (let row = 0; row < 5; row++) all.push([col, row]);
      return [all];
    }
  }
}

export interface CardProgress {
  /** Squares still needed for the closest winning line. */
  remaining: number;
  /** Coordinates of every completed line (empty until the card wins). */
  completed: [number, number][][];
  won: boolean;
}

export function evaluateCard(
  card: Card,
  drawn: ReadonlySet<number>,
  patternName: WinPattern,
): CardProgress {
  const lines = winningLines(patternName);
  const completed: [number, number][][] = [];
  let remaining = Number.POSITIVE_INFINITY;

  // 'x' requires BOTH diagonals, so it is scored as one combined requirement.
  if (patternName === 'x') {
    let missing = 0;
    for (const line of lines) {
      for (const [col, row] of line) if (!isDaubed(card, col, row, drawn)) missing++;
    }
    const won = missing === 0;
    return { remaining: missing, completed: won ? lines : [], won };
  }

  for (const line of lines) {
    let missing = 0;
    for (const [col, row] of line) if (!isDaubed(card, col, row, drawn)) missing++;
    if (missing === 0) completed.push(line);
    if (missing < remaining) remaining = missing;
  }

  return { remaining, completed, won: completed.length > 0 };
}

/** How many more balls this card needs to win. Used for the "hot cards" rail. */
export function ballsToGo(card: Card, drawn: ReadonlySet<number>, patternName: WinPattern): number {
  return evaluateCard(card, drawn, patternName).remaining;
}

// ---------------------------------------------------------------------------
// Draw order
// ---------------------------------------------------------------------------

/**
 * The full 1-75 draw order for a round, derived from the revealed server seed.
 * Anyone can re-run this after settlement to verify the round was not rigged.
 */
export function drawOrder(serverSeed: string): number[] {
  const pool: number[] = [];
  for (let n = 1; n <= 75; n++) pool.push(n);
  return shuffle(pool, rng(`bingo-draw:${serverSeed}`));
}

/** Column letter for a ball, e.g. 42 -> "N". */
export function letterFor(ball: number): string {
  const index = Math.min(4, Math.floor((ball - 1) / 15));
  return COLUMN_LETTERS[index] ?? 'B';
}
