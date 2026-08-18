import { CashCow, CowMark } from '@/components/CashCow';
import { DropClock } from '@/components/DropClock';
import { DropFeed } from '@/components/DropFeed';
import { WalletCheck } from '@/components/WalletCheck';
import { buyUrl, site } from '@/lib/site';

const STEPS = [
  {
    n: '01',
    title: `Hold $${site.symbol}`,
    body: 'That is the whole thing. No staking, no claiming, no transaction to sign. Your wallet just has to be holding when the snapshot lands.',
  },
  {
    n: '02',
    title: `Every ${site.dropMinutes} minutes`,
    body: 'The cow takes a snapshot of every holder on chain and splits the creator fees between them, weighted by how much you hold.',
  },
  {
    n: '03',
    title: 'SOL hits your wallet',
    body: 'Straight to the address that held. Nothing to claim, nothing to connect, no site to come back to. Then it does it again.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ------------------------------------------------------------------ */}
      {/* Nav                                                                */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b-2 border-ink bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <span className="inline-flex items-center gap-2.5">
            <CowMark className="h-8 w-8" />
            <span className="text-[19px] font-extrabold tracking-tight">
              Cash<span className="text-cash-500">Cow</span>
            </span>
          </span>
          <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-2.5">
            Buy ${site.symbol}
          </a>
        </nav>
      </header>

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* Hero — the clock is the product                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden border-b-2 border-ink bg-cash-50">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(34,212,107,0.22),transparent_70%)]" />
          <div className="relative mx-auto max-w-5xl px-5 py-12 text-center sm:py-16">
            <p className="label mb-4">Hold the cow. Get paid.</p>
            <h1 className="h-display mx-auto mb-4 max-w-3xl">
              Creator fees, milked
              <br />
              <span className="text-cash-500">every {site.dropMinutes} minutes.</span>
            </h1>
            <p className="mx-auto mb-10 max-w-xl text-[15px] leading-relaxed text-ink/65">
              Hold ${site.symbol}. Every {site.dropMinutes} minutes the cow snapshots every holder
              and sprays the creator fees straight into their wallets, split by how much they hold.
              Nothing to claim.
            </p>

            <DropClock />

            <div className="mx-auto mt-10 max-w-xl">
              <p className="label mb-2.5">Check your share</p>
              <WalletCheck />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Ticker                                                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="overflow-hidden border-b-2 border-ink bg-ink py-3">
          <div className="flex animate-[marquee_28s_linear_infinite] whitespace-nowrap">
            {[0, 1].map((copy) => (
              <span key={copy} className="flex shrink-0 items-center gap-8 pr-8">
                {[
                  'No claiming',
                  `Paid every ${site.dropMinutes} minutes`,
                  '100% of fees to holders',
                  'Weighted by your bag',
                  'Straight to your wallet',
                ].map((item) => (
                  <span key={item} className="flex items-center gap-8">
                    <span className="font-mono text-[11px] uppercase tracking-label text-cash-300">
                      {item}
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-cash-500" />
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* How                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-b-2 border-ink bg-white py-16">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="h-display mb-10 max-w-lg">Three steps. One of them is nothing.</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <article
                  key={step.n}
                  className="rounded-3xl border-2 border-ink bg-cash-50 p-6 shadow-lift"
                >
                  <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-ink bg-cash-400 font-mono text-[13px] font-bold">
                    {step.n}
                  </span>
                  <h3 className="mb-2 text-lg font-extrabold tracking-tight">{step.title}</h3>
                  <p className="text-[13.5px] leading-relaxed text-ink/65">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Feed                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-b-2 border-ink bg-smoke py-16">
          <div className="mx-auto max-w-5xl px-5">
            <h2 className="h-display mb-3">Every drop, on the record.</h2>
            <p className="mb-8 max-w-xl text-[15px] leading-relaxed text-ink/65">
              Each payout is a real transaction on Solana. Nothing is announced that didn&rsquo;t
              happen.
            </p>
            <DropFeed />
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CTA                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-cash-400 py-16">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-5 text-center">
            <CashCow className="w-[200px]" noteCount={10} />
            <h2 className="h-display max-w-lg">The next drop is already filling.</h2>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-ghost">
                Buy ${site.symbol} on pump.fun
              </a>
              {site.telegram ? (
                <a href={site.telegram} target="_blank" rel="noreferrer" className="btn-ghost">
                  Telegram
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-ink bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-7 text-center">
          <span className="inline-flex items-center gap-2">
            <CowMark className="h-6 w-6" />
            <span className="text-[15px] font-extrabold tracking-tight">
              Cash<span className="text-cash-500">Cow</span>
            </span>
          </span>
          <p className="max-w-xl font-mono text-[10px] uppercase leading-relaxed tracking-label text-ink/45">
            A memecoin. Not financial advice. Not affiliated with, endorsed by or connected to any
            payment app, bank or exchange. Drops depend entirely on creator fees earned —
            if there is no volume, there is nothing to drop.
          </p>
        </div>
      </footer>
    </div>
  );
}
