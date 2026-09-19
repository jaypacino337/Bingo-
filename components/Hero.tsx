import { ChartLine } from './ChartLine';
import { Counter } from './Counter';
import { Reveal } from './Reveal';
import { hero, marketStats } from '@/lib/content';
import { buyUrl, site } from '@/lib/site';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      {/* One green bloom behind the headline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2
                   animate-pulse-glow rounded-full bg-up/[0.13] blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pb-24">
        {/* ---------------------------------------------------------------- */}
        <div>
          <Reveal>
            <p className="label mb-6 flex items-center gap-3">
              <span className="h-[1px] w-8 bg-up" />
              {hero.eyebrow}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mb-7 text-[52px] font-black uppercase leading-[0.9] tracking-tightest sm:text-[76px] lg:text-[88px]">
              {hero.headline[0]}
              <br />
              <span className="text-up">{hero.headline[1]}</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <div className="mb-8 space-y-1.5 border-l border-line pl-5">
              {hero.lines.map((line) => (
                <p key={line} className="text-[15px] leading-relaxed text-white/80 sm:text-base">
                  {line}
                </p>
              ))}
              <p className="pt-2.5 text-[15px] leading-relaxed text-muted sm:text-base">
                {hero.kicker}
              </p>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
                {hero.primaryCta}
              </a>
              <a href="#receipts" className="btn-ghost">
                {hero.secondaryCta}
              </a>
            </div>
          </Reveal>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* The missed-move terminal                                          */}
        {/* ---------------------------------------------------------------- */}
        <Reveal delay={200}>
          <MissedMovePanel />
        </Reveal>
      </div>
    </section>
  );
}

/** A mock terminal panel: one big chart, a strip of movers underneath. */
function MissedMovePanel() {
  const feature = marketStats[0]!;
  const rest = marketStats.slice(1, 4);

  return (
    <div className="panel relative overflow-hidden shadow-[0_40px_120px_-40px_rgba(25,251,123,0.25)]">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-line" />
          <span className="h-2 w-2 rounded-full bg-line" />
          <span className="h-2 w-2 rounded-full bg-up/70" />
          <span className="ml-2 font-mono text-[10px] uppercase tracking-label text-muted">
            missed_move.log
          </span>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label text-up">
          <span className="h-1.5 w-1.5 rounded-full bg-up" />
          live
        </span>
      </div>

      {/* feature chart */}
      <div className="px-5 pt-5">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[13px] font-bold uppercase tracking-wide">{feature.asset}</span>
          <span className="num text-[13px] font-bold text-up">
            +<Counter to={feature.offLows} suffix="%" />
          </span>
        </div>
        <p className="label-muted mb-4">off the lows</p>
        <ChartLine series={feature.series} height={132} strokeWidth={2.5} className="h-32 w-full" />
      </div>

      {/* movers */}
      <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
        {rest.map((stat) => (
          <div key={stat.asset} className="px-3 py-4">
            <p className="truncate font-mono text-[9.5px] uppercase tracking-label text-muted">
              {stat.asset}
            </p>
            <p className="num mt-1 text-[15px] font-bold text-up">
              +<Counter to={stat.offLows} suffix="%" />
            </p>
            <ChartLine
              series={stat.series}
              height={30}
              strokeWidth={1.5}
              showDot={false}
              className="mt-2 h-7 w-full"
            />
          </div>
        ))}
      </div>

      {/* the punchline */}
      <div className="flex items-center justify-between gap-3 border-t border-line bg-night/60 px-5 py-3.5">
        <span className="font-mono text-[10px] uppercase tracking-label text-muted">
          your position
        </span>
        <span className="font-mono text-[11px] uppercase tracking-label text-down">
          none
          <span className="ml-1 animate-blink text-up">_</span>
        </span>
      </div>
    </div>
  );
}
