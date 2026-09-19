import Image from 'next/image';
import { Reveal } from './Reveal';
import { finalCta } from '@/lib/content';
import { buyUrl, site } from '@/lib/site';

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-line py-24 lg:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-52 left-1/2 h-[460px] w-[900px] -translate-x-1/2
                   animate-pulse-glow rounded-full bg-up/[0.14] blur-[130px]"
      />

      {/* Banner, full-bleed, fading into the section so it sits in the page
          rather than on top of it. */}
      <div className="relative mb-14 overflow-hidden">
        <Image
          src="/brand/banner.png"
          alt="SIDELINED"
          width={2172}
          height={724}
          sizes="100vw"
          className="h-[200px] w-full object-cover object-center sm:h-[290px] lg:h-[360px]"
        />
        {/* Bottom-weighted only. Side fades ate into the wordmark, and the
            artwork's own edges are already dark enough to sit on the page. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-night/45 via-transparent to-night"
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <Reveal>
          <h2 className="mb-6 text-[38px] font-black uppercase leading-[0.94] tracking-tightest sm:text-[56px] lg:text-[64px]">
            Stop watching.
            <br />
            <span className="text-up">Start moving.</span>
          </h2>
        </Reveal>

        <Reveal delay={90}>
          <p className="mx-auto mb-10 max-w-lg text-[15px] leading-relaxed text-muted sm:text-base">
            {finalCta.body}
          </p>
        </Reveal>

        <Reveal delay={170}>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
              {finalCta.primary}
            </a>
            {site.twitter ? (
              <a href={site.twitter} target="_blank" rel="noreferrer" className="btn-ghost">
                {finalCta.secondary}
              </a>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
