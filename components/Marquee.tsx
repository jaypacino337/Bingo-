import { fullTokens } from '@/lib/format';
import { site } from '@/lib/site';

/** The scrolling strip between sections. */
export function Marquee() {
  const items = [
    `${fullTokens(site.tokensPerCard)} $${site.symbol} = 1 fighter`,
    'Last one standing takes the fees',
    'Eight enter the duels · one walks out',
    '80% pot · 20% jackpot',
    '1-in-25 jackpot roll',
  ];

  // Rendered twice so the loop is seamless at -50%.
  const strip = [...items, ...items];

  return (
    <div className="overflow-hidden border-y-2 border-forest-900 bg-forest-800 py-3">
      <div className="flex w-max animate-marquee items-center gap-10 pr-10">
        {strip.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-10">
            <span className="font-mono text-[11px] uppercase tracking-label text-pump-300">
              {item}
            </span>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-pump-500" />
          </span>
        ))}
      </div>
    </div>
  );
}
