/**
 * Number formatting and the derived maths for the two data sections.
 *
 * Percentages and multiples are always computed from the low/now prices —
 * never typed in by hand — so a card can't show "+82%" next to two numbers
 * that don't actually multiply to that.
 */

export type ValueFormat = 'usd' | 'usdCompact' | 'perDay' | 'plain';

/** Significant-figure aware price formatting, so $0.000041 survives. */
export function formatValue(n: number, format: ValueFormat = 'usd'): string {
  switch (format) {
    case 'usdCompact':
      return `$${compact(n)}`;
    case 'perDay':
      return `${compact(n)} / day`;
    case 'plain':
      return compact(n);
    case 'usd':
    default:
      return `$${price(n)}`;
  }
}

function price(n: number): string {
  if (n === 0) return '0';
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  // Sub-dollar: keep four significant figures so meme prices stay readable.
  const decimals = Math.min(12, Math.max(2, -Math.floor(Math.log10(n)) + 3));
  return n.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

function compact(n: number): string {
  if (n >= 1e9) return `${trim(n / 1e9)}B`;
  if (n >= 1e6) return `${trim(n / 1e6)}M`;
  if (n >= 1e3) return `${trim(n / 1e3)}K`;
  return trim(n);
}

function trim(n: number): string {
  return n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2).replace(/0$/, '');
}

/** Percent gain from the low. 45,000 → 81,000 is +80%. */
export function pctOffLow(low: number, now: number): number {
  if (!low || low <= 0) return 0;
  return (now / low - 1) * 100;
}

/** Multiple on the money. 45,000 → 81,000 is 1.8x. */
export function multipleOf(entry: number, current: number): number {
  if (!entry || entry <= 0) return 0;
  return current / entry;
}

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}
