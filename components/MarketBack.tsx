import { ChartLine } from './ChartLine';
import { Counter } from './Counter';
import { Reveal } from './Reveal';
import { asOf, marketBody, marketHeadline, marketStats } from '@/lib/content';
import { formatValue, pctOffLow } from '@/lib/format';

export function MarketBack() {
  return (
    <section id="market" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="label mb-5">01 — The market is back</p>
          <h2 className="h-section mb-5 max-w-3xl">{marketHeadline}</h2>
          <p className="mb-12 max-w-xl text-[15px] leading-relaxed text-muted">{marketBody}</p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {marketStats.map((stat, i) => {
            const offLows = pctOffLow(stat.low, stat.now);
            return (
            <Reveal key={stat.asset} delay={i * 70}>
              <article className="card group h-full p-5">
                {/* accent wash on hover */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-up/0 to-up/0 transition-colors duration-500 group-hover:to-up/[0.05]" />

                <div className="relative">
                  <div className="mb-5 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-bold uppercase tracking-wide">{stat.asset}</p>
                      <p className="mt-1 text-[11px] leading-snug text-muted">{stat.note}</p>
                    </div>
                    <span className="num shrink-0 rounded-full bg-up/10 px-2.5 py-1 text-[11px] font-bold text-up">
                      +<Counter to={offLows} decimals={offLows < 100 ? 1 : 0} suffix="%" />
                    </span>
                  </div>

                  <ChartLine series={stat.series} height={64} className="mb-5 h-16 w-full" />

                  <div className="flex items-end justify-between border-t border-line pt-3.5">
                    <div>
                      <p className="label-muted mb-1">Low</p>
                      <p className="num text-[13px] text-muted line-through decoration-line">
                        {formatValue(stat.low, stat.format)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="label-muted mb-1">Now</p>
                      <p className="num text-[15px] font-bold">
                        {formatValue(stat.now, stat.format)}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-label text-muted/60">
            {asOf}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
