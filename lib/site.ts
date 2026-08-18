/**
 * Everything you configure per-deploy lives here.
 * Set these in Vercel → Settings → Environment Variables.
 */

export const site = {
  name: 'Cash Cow',
  tagline: 'Hold the cow. Get paid.',
  symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? 'COW',
  /** The CA. */
  mint: process.env.NEXT_PUBLIC_TOKEN_MINT ?? '',
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? '',
  /** Minutes between drops, for the marketing copy. Matches the server. */
  dropMinutes: Number(process.env.NEXT_PUBLIC_DROP_MINUTES ?? 5),
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL ?? '',
};

/** Where the buy button points. Falls back to pump.fun if no CA is set. */
export function buyUrl(): string {
  return site.mint ? `https://pump.fun/coin/${site.mint}` : 'https://pump.fun';
}

export function solscanUrl(address: string): string {
  return `https://solscan.io/account/${address}`;
}


