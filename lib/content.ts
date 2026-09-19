/**
 * Everything editable lives here.
 *
 * Copy, numbers, receipts, links — change this file and the whole site
 * follows. No component holds its own text.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ THE NUMBERS BELOW ARE PLACEHOLDERS.                                 │
 * │ They are shaped like real data so the layout is honest, but they    │
 * │ are not live and they are not sourced. Replace them with real       │
 * │ figures before launch, and keep `asOf` current.                     │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import type { ValueFormat } from './format';

/**
 * Shown under both data sections. While any number below is still a guess,
 * leave this saying so — it is the only thing stopping the site from
 * presenting invented figures as sourced.
 */
export const asOf = 'BTC / SOL live as of Sep 2026 · lows and meme figures are placeholders';

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export const hero = {
  eyebrow: 'The market came back',
  headline: ['Still', 'sidelined?'],
  // Swap for: ['You said', 'it was over.']
  lines: [
    'Bitcoin bounced.',
    'Sol ripped.',
    'Meme volume came back.',
    'People called the cycle dead and stayed sidelined.',
  ],
  kicker: 'SIDELINED is for everyone who watched the move and still didn’t click buy.',
  primaryCta: 'Buy $SIDELINED',
  secondaryCta: 'See the receipts',
};

export const ticker = [
  'You said it was over',
  'The chart disagreed',
  'Still waiting for lower',
  'Volume came back without you',
  'One more dip',
  'Zoom out',
  'Still sidelined',
];

// ---------------------------------------------------------------------------
// Section 1 — the market is back
// ---------------------------------------------------------------------------

export interface MarketStat {
  asset: string;
  note: string;
  /** Value at the low. */
  low: number;
  /** Value now. */
  now: number;
  /** How low/now are rendered. */
  format?: ValueFormat;
  /** 0-1 values, oldest first. Shape only — this draws the sparkline. */
  series: number[];
}

export const marketHeadline = 'The bull didn’t ask for permission.';
export const marketBody =
  'Every leg up had a chorus calling for lower. The chorus was loud. The chart was louder.';

export const marketStats: MarketStat[] = [
  {
    asset: 'BTC',
    note: 'Called dead at the lows',
    low: 45_000, // ← PLACEHOLDER: set the actual local low
    now: 81_000,
    series: [0.18, 0.1, 0.22, 0.16, 0.34, 0.29, 0.48, 0.44, 0.63, 0.58, 0.78, 0.86, 0.94],
  },
  {
    asset: 'SOL',
    note: '“It’s going to zero”',
    low: 50, // ← PLACEHOLDER: set the actual local low
    now: 111,
    series: [0.12, 0.08, 0.14, 0.11, 0.26, 0.2, 0.42, 0.36, 0.55, 0.62, 0.7, 0.85, 0.97],
  },
  {
    asset: 'MEME VOL',
    note: '“Memes are over”',
    low: 40_000_000, // ← PLACEHOLDER
    now: 1_600_000_000,
    format: 'perDay',
    series: [0.06, 0.05, 0.09, 0.07, 0.16, 0.12, 0.3, 0.26, 0.52, 0.48, 0.74, 0.88, 1.0],
  },
  {
    asset: 'NEW LAUNCHES',
    note: '“Nobody is buying”',
    low: 6_000, // ← PLACEHOLDER
    now: 22_000,
    format: 'perDay',
    series: [0.1, 0.07, 0.13, 0.18, 0.15, 0.3, 0.27, 0.45, 0.6, 0.55, 0.8, 0.9, 0.96],
  },
];

// ---------------------------------------------------------------------------
// Section 2 — $1,000 at the lows
// ---------------------------------------------------------------------------

export interface LowsRow {
  asset: string;
  tag: string;
  /** Price you'd have paid at the low. */
  entry: number;
  /** Price now. The multiple and the dollar value derive from these two. */
  current: number;
  format?: ValueFormat;
}

export const lowsHeadline = '$1,000 looks different when you weren’t sidelined.';
export const lowsBody =
  'Same thousand dollars. Different decision. The only variable was whether you clicked.';

/** Entries and currents above; the multiple and the payout derive from them. */

export const lowsStake = 1000;

export const lowsRows: LowsRow[] = [
  { asset: 'BTC', tag: 'Local low', entry: 45_000, current: 81_000 },
  { asset: 'SOL', tag: 'Local low', entry: 50, current: 111 },
  { asset: 'Meme runner', tag: 'Day one', entry: 0.0008, current: 0.0112 },
  { asset: 'The one you watched', tag: 'You didn’t buy', entry: 0.00004, current: 0.0017 },
];

export const lowsFooter = 'Still sidelined?';

// ---------------------------------------------------------------------------
// Section 3 — receipts
//
// Drop images into public/receipts/ and list them here. Anything with a
// `src` renders the image; anything without renders as a quote card, so the
// wall looks intentional before you have a single screenshot.
// ---------------------------------------------------------------------------

export interface Receipt {
  src?: string;
  /** Shown when there is no image yet. */
  quote?: string;
  handle?: string;
}

export const receiptsHeadline = 'The timeline saw it too.';
export const receiptsBody =
  'Everyone had an opinion. Everyone had a reason not to buy. Now the same people are posting from the sidelines.';

export const receipts: Receipt[] = [
  { quote: 'still sidelined tbh', handle: '@anon' },
  { quote: 'waiting for the retest', handle: '@anon' },
  { quote: 'this bounce is fake', handle: '@anon' },
  { quote: 'memes are done this cycle', handle: '@anon' },
  { quote: 'i’ll buy at the 200w', handle: '@anon' },
  { quote: 'missed it again', handle: '@anon' },
  { quote: 'cycle top is in', handle: '@anon' },
  { quote: 'one more leg down first', handle: '@anon' },
  { quote: 'sitting this one out', handle: '@anon' },
];

// ---------------------------------------------------------------------------
// Section 4 — the thesis
// ---------------------------------------------------------------------------

export const thesisHeadline = 'SIDELINED is the trade.';

export const thesisLines = [
  'Every cycle makes the same character.',
  'The buyer who waited.',
  'The one who wanted one more dip.',
  'The one who watched it happen without him.',
];

export const thesisKicker = 'SIDELINED packages that feeling into a token.';

export const thesisCards = [
  { label: 'Markets', value: 'Back', note: 'The recovery already happened. Receipts above.' },
  { label: 'Memes', value: 'Back', note: 'Volume returned. Launches returned. Runners returned.' },
  { label: 'People', value: 'Still sidelined', note: 'Same wallets. Same excuses. Higher prices.' },
];

// ---------------------------------------------------------------------------
// Section 5 — why now
// ---------------------------------------------------------------------------

export const whyHeadline = 'Because the coping never stops.';

export const whyPairs = [
  { said: 'Memes were dead.', then: 'Volume came back.' },
  { said: 'The bounce was fake.', then: 'The chart kept climbing.' },
  { said: 'Waiting for a better entry.', then: 'Still waiting.' },
];

export const whyKicker = 'That’s the whole joke. That’s why it works.';

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

export const finalCta = {
  headline: 'Stop watching. Start moving.',
  body: 'The move doesn’t wait for perfect entries. SIDELINED exists because too many people are still waiting.',
  primary: 'Buy $SIDELINED',
  secondary: 'Follow on X',
};
