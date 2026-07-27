/**
 * Everything you configure per-deploy lives here.
 * Set these in Vercel → Settings → Environment Variables.
 */

export const site = {
  name: 'Bingo.fun',
  tagline: 'Eyes down. Fees up.',
  symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? 'BINGO',
  /** The CA. */
  mint: process.env.NEXT_PUBLIC_TOKEN_MINT ?? '',
  tokensPerCard: Number(process.env.NEXT_PUBLIC_TOKENS_PER_CARD ?? 1_000_000),
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? '',
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL ?? '',
  /** Name shown on the caller panel in the hall. */
  callerName: process.env.NEXT_PUBLIC_CALLER_NAME ?? 'ALON',
  callerTitle: process.env.NEXT_PUBLIC_CALLER_TITLE ?? 'Founder of the hall (pump.fun)',
};

/** Where "BUY $BINGO" points. Falls back to pump.fun's search if no CA is set. */
export function buyUrl(): string {
  return site.mint ? `https://pump.fun/coin/${site.mint}` : 'https://pump.fun';
}

export function solscanUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}

/**
 * Most cards one wallet can play. Mirrors the server's cap, which is derived
 * from the max-wallet rule: 5% of a 1,000,000,000 supply is 50,000,000 tokens,
 * and at 1,000,000 per card that is 50 cards.
 */
export const maxCards = Number(process.env.NEXT_PUBLIC_MAX_CARDS ?? 50);

/** Entry tiers for the "your bag is your book of cards" table. */
export const ENTRY_TIERS = [1, 5, 10, 25, maxCards]
  .filter((cards, i, all) => cards <= maxCards && all.indexOf(cards) === i)
  .map((cards) => ({ held: cards * site.tokensPerCard, cards }));
