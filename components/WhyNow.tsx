import { Reveal } from './Reveal';
import { whyHeadline, whyKicker, whyPairs } from '@/lib/content';

/** Said / then — the cope on the left, the chart's reply on the right. */
export function WhyNow() {
  return (
    <section className="py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-5">
        <Reveal>
          <p className="label mb-5">05 — Why now</p>
          <h2 className="h-section mb-12 max-w-2xl">{whyHeadline}</h2>
        </Reveal>

        <div className="divide-y divide-line border-y border-line">
          {whyPairs.map((pair, i) => (
            <Reveal key={pair.said} delay={i * 80}>
              <div className="grid grid-cols-1 items-center gap-2 py-6 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
                <p className="text-[16px] text-muted line-through decoration-line sm:text-[18px]">
                  {pair.said}
                </p>
                <span className="font-mono text-[11px] uppercase tracking-label text-up">→</span>
                <p className="text-[16px] font-bold sm:text-right sm:text-[18px]">{pair.then}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-10 text-center text-[19px] font-black uppercase leading-tight tracking-tight sm:text-[24px]">
            {whyKicker}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
