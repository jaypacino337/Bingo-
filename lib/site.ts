/** Per-deploy config. Set these in Vercel → Environment Variables. */

export const site = {
  name: 'SIDELINED',
  symbol: process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? 'SIDELINED',
  /** The CA. Shown in the nav and drives the buy link. */
  mint: process.env.NEXT_PUBLIC_TOKEN_MINT ?? '',
  twitter: process.env.NEXT_PUBLIC_TWITTER_URL ?? '',
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL ?? '',
  /** Override if you launch somewhere other than pump.fun. */
  buyUrlOverride: process.env.NEXT_PUBLIC_BUY_URL ?? '',
};

export function buyUrl(): string {
  if (site.buyUrlOverride) return site.buyUrlOverride;
  return site.mint ? `https://pump.fun/coin/${site.mint}` : 'https://pump.fun';
}

export function shortMint(): string {
  if (!site.mint) return 'CA: TBA';
  return `${site.mint.slice(0, 5)}…${site.mint.slice(-5)}`;
}
