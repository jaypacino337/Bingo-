import { ticker } from '@/lib/content';

/** The scrolling strip. Rendered twice so the loop at -50% is seamless. */
export function Ticker({ fast = false }: { fast?: boolean }) {
  const items = [...ticker, ...ticker];

  return (
    <div className="fade-x overflow-hidden border-y border-line bg-panel/60 py-3">
      <div className={`flex w-max ${fast ? 'animate-marquee-fast' : 'animate-marquee'}`}>
        {items.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-6 px-6">
            <span className="font-mono text-[11px] uppercase tracking-label text-muted">
              {item}
            </span>
            <span className="h-1 w-1 shrink-0 rotate-45 bg-up/60" />
          </span>
        ))}
      </div>
    </div>
  );
}
