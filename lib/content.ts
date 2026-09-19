/**
 * Everything editable lives here.
 *
 * Copy, numbers, receipts, links — change this file and the whole site
 * follows. No component holds its own text.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ NUMBERS MARKED "PLACEHOLDER" ARE INVENTED.                          │
 * │ The 2018 / 2020 / 2022 lows are real and roughly right. Recent      │
 * │ lows and every meme figure are not — replace them from a real       │
 * │ chart, then trim `asOf` to match what is actually sourced.          │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import type { ValueFormat } from './format';

/**
 * Shown under both data sections. While any number below is still a guess,
 * leave this saying so — it is the only thing stopping the site from
 * presenting invented figures as sourced.
 */
export const asOf =
  'Historic lows approximate · recent lows and meme volume are placeholders — update before launch';

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

/**
 * One point on a cycle timeline. Points with `said` get pinned to the chart
 * and listed underneath — those are the moments everyone called it over.
 *
 * ACCURACY NOTE: the 2018, 2020 and 2022 lows are well-documented and roughly
 * right. Anything marked PLACEHOLDER is not — replace it from a real chart
 * before launch, and trim `asOf` once you have.
 */
export interface CyclePoint {
  when: string;
  /** Actual value. The chart is log-scaled, so 3,200 and 81,000 both read. */
  v: number;
  /** What the timeline was saying at this point. Pins it to the chart. */
  said?: string;
}

export interface CycleSeries {
  key: string;
  asset: string;
  tab: string;
  format?: ValueFormat;
  /** Oldest first. */
  points: CyclePoint[];
  /** The line under the chart once you've seen the pattern. */
  verdict: string;
}

export const marketHeadline = 'The bull didn’t ask for permission.';
export const marketBody =
  'Every bottom had a chorus calling for lower. Every single one. Here is the chorus, pinned to the chart it was wrong about.';

export const cycles: CycleSeries[] = [
  {
    key: 'btc',
    asset: 'BTC',
    tab: 'Bitcoin',
    points: [
      { when: 'Dec 2017', v: 19_800 },
      { when: 'Dec 2018', v: 3_200, said: 'Bubble popped. It’s going to zero.' },
      { when: 'Jun 2019', v: 13_000 },
      { when: 'Mar 2020', v: 3_850, said: 'COVID killed it. Crypto is done.' },
      { when: 'Nov 2021', v: 69_000 },
      { when: 'Nov 2022', v: 15_500, said: 'FTX killed it. The whole thing is a fraud.' },
      { when: 'Mar 2024', v: 73_000 },
      { when: 'The last low', v: 45_000, said: 'Cycle top is in. Waiting for lower.' }, // PLACEHOLDER
      { when: 'Now', v: 81_000 },
    ],
    verdict: 'Declared dead 400+ times. Priced higher after every one.',
  },
  {
    key: 'sol',
    asset: 'SOL',
    tab: 'Solana',
    points: [
      { when: 'May 2020', v: 0.78 },
      { when: 'Nov 2021', v: 260 },
      { when: 'Dec 2022', v: 8, said: 'Solana is dead. It was just an FTX coin.' },
      { when: 'Mar 2024', v: 200 },
      { when: 'The last low', v: 50, said: 'Chain is over. Nobody is building.' }, // PLACEHOLDER
      { when: 'Now', v: 111 },
    ],
    verdict: 'Written off at $8. Everyone who agreed is still sidelined.',
  },
  {
    key: 'memes',
    asset: 'MEME VOL',
    tab: 'Meme volume',
    format: 'perDay',
    points: [
      // PLACEHOLDER — pull real daily volume off DexScreener before launch.
      { when: '2021', v: 900_000_000 },
      { when: '2022', v: 30_000_000, said: 'Memecoins are a 2021 thing. It’s over.' },
      { when: '2023', v: 180_000_000 },
      { when: 'The lull', v: 40_000_000, said: 'Meta is dead. Nobody is buying memes.' },
      { when: 'Now', v: 1_600_000_000 },
    ],
    verdict: 'Pronounced dead every lull. Back every time, without you.',
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
