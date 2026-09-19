import { Reveal } from './Reveal';
import { receipts, receiptsBody, receiptsHeadline, type Receipt } from '@/lib/content';

/**
 * The screenshot wall.
 *
 * A masonry column layout, so screenshots of different heights pack without
 * gaps and without being cropped — the worst thing you can do to a tweet
 * screenshot is cut the handle off. Entries without an image render as quote
 * cards in the same visual language, so the wall looks finished before a
 * single file is added.
 */
export function Receipts() {
  return (
    <section id="receipts" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="label mb-5">03 — Receipts</p>
          <h2 className="h-section mb-5 max-w-3xl">{receiptsHeadline}</h2>
          <p className="mb-12 max-w-xl text-[15px] leading-relaxed text-muted">{receiptsBody}</p>
        </Reveal>

        <div className="[column-fill:_balance] gap-4 sm:columns-2 lg:columns-3">
          {receipts.map((receipt, i) => (
            <Reveal key={i} delay={(i % 3) * 70} className="mb-4 break-inside-avoid">
              <ReceiptCard receipt={receipt} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReceiptCard({ receipt }: { receipt: Receipt }) {
  if (receipt.src) {
    return (
      <figure className="card group p-1.5">
        {/* Plain <img>: these are operator-supplied files dropped into
            public/receipts, so there is nothing for next/image to know at
            build time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={receipt.src}
          alt={receipt.handle ? `Post from ${receipt.handle}` : 'Receipt'}
          loading="lazy"
          className="w-full rounded-xl opacity-90 transition-opacity duration-300 group-hover:opacity-100"
        />
      </figure>
    );
  }

  return (
    <blockquote className="card p-5">
      <p className="mb-4 text-[15px] leading-snug text-white/85">
        <span className="text-up">“</span>
        {receipt.quote}
        <span className="text-up">”</span>
      </p>
      <footer className="flex items-center justify-between border-t border-line pt-3.5">
        <span className="font-mono text-[10px] uppercase tracking-label text-muted">
          {receipt.handle}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-label text-down">still out</span>
      </footer>
    </blockquote>
  );
}
