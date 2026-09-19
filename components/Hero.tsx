import Image from 'next/image';
import { Reveal } from './Reveal';
import { hero } from '@/lib/content';
import { buyUrl } from '@/lib/site';

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 sm:pt-32">
      {/* One green bloom behind the headline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2
                   animate-pulse-glow rounded-full bg-up/[0.13] blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-24">
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

        <Reveal delay={200}>
          <HeroArt />
        </Reveal>
      </div>
    </section>
  );
}

/**
 * The key art, framed as a terminal window.
 *
 * The illustration is already a porthole with someone watching the move from
 * the wrong side of it, so wrapping it in window chrome and captioning it
 * "your position: none" lets the picture carry the joke instead of a chart
 * restating what section 01 is about to say anyway.
 */
function HeroArt() {
  return (
    <div className="panel relative overflow-hidden shadow-[0_40px_120px_-40px_rgba(25,251,123,0.3)]">
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

      <div className="relative aspect-square">
        <Image
          src="/brand/logo.png"
          alt="Watching the bull market through barred glass while everyone else celebrates"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 46vw"
          className="object-cover"
        />
      </div>

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
