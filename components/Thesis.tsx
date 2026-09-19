import { Reveal } from './Reveal';
import { thesisCards, thesisHeadline, thesisKicker, thesisLines } from '@/lib/content';

export function Thesis() {
  return (
    <section id="thesis" className="scroll-mt-20 border-y border-line bg-panel/40 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <p className="label mb-5">04 — The thesis</p>
            <h2 className="h-section">{thesisHeadline}</h2>
          </Reveal>

          <Reveal delay={100}>
            <div className="space-y-3 border-l border-line pl-6">
              {thesisLines.map((line, i) => (
                <p
                  key={line}
                  className={`text-[17px] leading-snug sm:text-[19px] ${
                    i === 0 ? 'text-white' : 'text-white/70'
                  }`}
                >
                  {line}
                </p>
              ))}
              <p className="pt-4 text-[17px] font-bold leading-snug text-up sm:text-[19px]">
                {thesisKicker}
              </p>
            </div>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {thesisCards.map((card, i) => (
            <Reveal key={card.label} delay={i * 80}>
              <article className="card h-full p-6">
                <p className="label-muted mb-3">{card.label}</p>
                <p className="mb-3 text-[24px] font-black uppercase leading-none tracking-tight text-up">
                  {card.value}
                </p>
                <p className="text-[13px] leading-relaxed text-muted">{card.note}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
