export const LAMPORTS_PER_SOL = 1_000_000_000;

export function sol(lamports: number, digits = 3): string {
  const value = lamports / LAMPORTS_PER_SOL;
  if (value === 0) return '0';
  if (value < 0.001) return value.toExponential(1);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function shortWallet(wallet: string, head = 4, tail = 4): string {
  if (wallet.length <= head + tail + 1) return wallet;
  return `${wallet.slice(0, head)}…${wallet.slice(-tail)}`;
}

export function compactTokens(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return Math.floor(amount).toLocaleString();
}

export function fullTokens(amount: number): string {
  return Math.floor(amount).toLocaleString();
}

/** mm:ss for a countdown, floored at zero. */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function patternLabel(pattern: 'line' | 'x' | 'full'): string {
  if (pattern === 'full') return 'Full house';
  if (pattern === 'x') return 'Two-line cross';
  return 'Any line';
}
