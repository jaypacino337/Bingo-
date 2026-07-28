import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Marquee } from '@/components/Marquee';
import { WalletSearch } from '@/components/WalletSearch';
import { LivePot } from '@/components/LivePot';
import { fullTokens } from '@/lib/format';
import { buyUrl, site, maxCards, ENTRY_TIERS } from '@/lib/site';

const STEPS = [
  {
    step: 'Step 01 — Hold',
    title: `Buy and hold $${site.symbol}`,
    body: `Every ${fullTokens(site.tokensPerCard)} $${site.symbol} in your wallet is one fighter in the arena. Hold ${fullTokens(site.tokensPerCard * 10)}? Ten fighters swinging for you every round. No staking, no claiming — just hold.`,
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="1.8" stroke="currentColor">
        <rect x="2" y="6" width="20" height="12" rx="2.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M5 9v6M19 9v6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: 'Step 02 — The cull',
    title: 'Waves take the field',
    body: 'The arena fills, then waves of elimination cut it down fast — half the field gone, then half again, until only eight fighters are left standing. Watch your squad thin out in real time.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="1.8" stroke="currentColor">
        <path d="M3 5h18M5 10h14M8 15h8M11 20h2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: 'Step 03 — The duels',
    title: 'Last one standing takes it',
    body: `The final eight go head to head, one duel at a time, until a single fighter is left. Their wallet takes 80% of every creator fee earned that round — and rolls a 1-in-${25} shot at the jackpot on top.`,
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="1.8" stroke="currentColor">
        <path d="M4 4l9 9M20 4l-9 9" strokeLinecap="round" />
        <path d="M14 14l6 6M10 14l-6 6" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.6" />
      </svg>
    ),
  },
];

const POT_STATS = [
  {
    value: '80/20',
    label: 'Pot split',
    body: 'Eighty percent of every pot goes to the last fighter standing. The other twenty rolls into the progressive jackpot, which keeps climbing until someone hits it.',
  },
  {
    value: '1M',
    label: 'Tokens per fighter',
    body: `The only rule of entry. Hold ${fullTokens(site.tokensPerCard)}, you have a fighter in the arena. Hold more, you have more — up to ${maxCards}.`,
  },
  {
    value: '1-in-25',
    label: 'Jackpot roll',
    body: 'Every champion rolls for the jackpot the moment they win. Hit it and the whole progressive pot lands on top of their winnings.',
  },
];

export default function HomePage() {
  return (
    <>
      <Nav />

      <main>
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative overflow-hidden bg-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_15%_0%,rgba(91,228,155,0.16),transparent_65%)]" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div>
              <p className="eyebrow mb-5 flex items-center gap-3">
                <span className="h-[2px] w-7 bg-pump-500" />
                Last one standing. On-chain. On pump.fun
              </p>

              <h1 className="h-display mb-5">
                Everyone fights.
                <br />
                <span className="text-pump-500">One walks out.</span>
              </h1>

              <p className="mb-7 max-w-lg text-[15px] leading-relaxed text-forest-900/70">
                A duel royale on Solana. Hold ${site.symbol} and your wallet fields fighters —
                one for every {fullTokens(site.tokensPerCard)} tokens. Waves cut the arena down to
                eight, the last eight duel head to head, and the survivor takes every creator fee
                earned that round.
              </p>

              <div className="mb-4">
                <p className="eyebrow mb-2">Check your squad</p>
                <WalletSearch />
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
                  Buy ${site.symbol}
                </a>
                <Link href="/play" className="btn-ghost">
                  Watch the arena
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[380px]">
              <DuelPreview />
            </div>
          </div>
        </section>

        <Marquee />

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section id="how-it-works" className="scroll-mt-20 bg-mint-100 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <p className="eyebrow mb-4">How it works</p>
            <h2 className="h-display mb-4 max-w-xl">Three steps between you and the pot.</h2>
            <p className="mb-10 max-w-2xl text-[15px] leading-relaxed text-forest-900/70">
              No tickets, no buy-ins, no transactions to sign. Your bag is your army — the more $
              {site.symbol} you hold, the more fighters you put in every single round.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map((step) => (
                <article
                  key={step.step}
                  className="rounded-2xl border-2 border-forest-900 bg-white p-6 shadow-lift"
                >
                  <span className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl border-2 border-forest-900 bg-pump-300 text-forest-900">
                    {step.icon}
                  </span>
                  <p className="eyebrow mb-2">{step.step}</p>
                  <h3 className="mb-2 text-lg font-extrabold tracking-tight">{step.title}</h3>
                  <p className="text-[13.5px] leading-relaxed text-forest-900/70">{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Entries                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section id="entries" className="scroll-mt-20 bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <p className="eyebrow mb-4">Fighters</p>
            <h2 className="h-display mb-10 max-w-xl">Your bag is your army.</h2>

            <div className="grid items-start gap-10 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border-2 border-forest-900 shadow-lift">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-forest-800">
                      <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-label text-pump-300">
                        ${site.symbol} held
                      </th>
                      <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-label text-pump-300">
                        Fighters per round
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENTRY_TIERS.map((tier, i) => (
                      <tr key={tier.held} className={i % 2 === 0 ? 'bg-white' : 'bg-mint-100'}>
                        <td className="border-t border-forest-900/10 px-5 py-3.5 font-mono text-[13px] font-medium tabular-nums text-forest-900">
                          {fullTokens(tier.held)}
                        </td>
                        <td className="border-t border-forest-900/10 px-5 py-3.5 font-mono text-[13px] font-bold tabular-nums text-pump-600">
                          {tier.cards} fighter{tier.cards === 1 ? '' : 's'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-3 text-xl font-extrabold tracking-tight">
                  More fighters, better odds. Not a guarantee.
                </h3>
                <p className="mb-4 text-[14px] leading-relaxed text-forest-900/70">
                  One fighter per {fullTokens(site.tokensPerCard)} ${site.symbol}, straight line, no
                  tiers to memorise. A snapshot is taken when each round opens — whatever&rsquo;s in
                  your wallet at that moment is your army for that round.
                </p>
                <p className="mb-5 text-[14px] leading-relaxed text-forest-900/70">
                  Every fighter has exactly the same chance of being the last one standing. Ten
                  fighters means ten shots, not a better shot — and one fighter can still take down
                  a whale in the final.
                </p>
                <div className="rounded-xl border-2 border-pump-500/30 bg-mint-100 p-4">
                  <p className="text-[13.5px] leading-relaxed text-forest-700">
                    Capped at {maxCards} fighters per wallet, in line with the 5% max holding —
                    nobody buys the arena.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* The pot                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section id="the-pot" className="hall-glow scroll-mt-20 bg-forest-900 py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-5">
            <p className="eyebrow-on-dark mb-4">The pot</p>
            <h2 className="h-display mb-4 max-w-xl text-white">
              Creator fees in. One survivor out.
            </h2>
            <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-pump-100/70">
              Every trade of ${site.symbol} on pump.fun earns creator fees. From the first cull to
              the final duel, all of it stacks into the live pot on screen.
            </p>

            <div className="mb-10">
              <LivePot tone="dark" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {POT_STATS.map((stat) => (
                <article key={stat.label} className="panel-dark p-6">
                  <p className="mb-1 text-3xl font-extrabold tracking-tight text-pump-400">
                    {stat.value}
                  </p>
                  <p className="stat-label mb-3">{stat.label}</p>
                  <p className="text-[13.5px] leading-relaxed text-pump-100/65">{stat.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* CTA                                                              */}
        {/* ---------------------------------------------------------------- */}
        <section className="bg-white py-20">
          <div className="mx-auto max-w-2xl px-5 text-center">
            <h2 className="h-display mb-4">
              The next round is filling.
              <br />
              <span className="text-pump-500">Got your fighters?</span>
            </h2>
            <p className="mb-7 text-[15px] text-forest-900/70">
              Hold {fullTokens(site.tokensPerCard)} ${site.symbol} and you&rsquo;re in every round
              automatically. Nothing to sign, nothing to claim.
            </p>
            <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
                Buy ${site.symbol} on pump.fun
              </a>
              <Link href="/play" className="btn-ghost">
                Watch the arena
              </Link>
              {site.telegram ? (
                <a href={site.telegram} target="_blank" rel="noreferrer" className="btn-ghost">
                  Join the Telegram
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/** Static hero art — a duel frozen mid-clash. */
function DuelPreview() {
  return (
    <div className="rounded-[26px] border-2 border-forest-900 bg-forest-800 p-4 shadow-card">
      <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-label text-pump-400/70">
        Final · duel 7 of 7
      </p>

      <div className="flex items-stretch justify-center gap-3">
        <div className="w-[38%] rounded-2xl border-2 border-pump-300 bg-pump-500/20 p-4 text-center shadow-[0_0_28px_-6px_rgba(134,239,172,0.7)]">
          <p className="mb-1 font-mono text-[11px] text-pump-200">7xKp…9fQz</p>
          <p className="text-lg font-extrabold tracking-tight text-white">#004</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-label text-pump-300">
            Survives
          </p>
        </div>

        <div className="flex shrink-0 items-center">
          <span className="text-2xl font-extrabold tracking-tight text-white">VS</span>
        </div>

        <div className="w-[38%] rounded-2xl border-2 border-white/10 bg-forest-800/40 p-4 text-center opacity-40">
          <p className="mb-1 font-mono text-[11px] text-pump-100/60">B2rT…4nMx</p>
          <p className="text-lg font-extrabold tracking-tight text-white/70">#011</p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-label text-red-300/80">
            Eliminated
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-1">
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-[2px] ${i === 0 ? 'bg-pump-300' : 'bg-white/8'}`}
          />
        ))}
      </div>
      <p className="mt-3 text-center font-mono text-[9.5px] uppercase tracking-label text-pump-400/50">
        1 of 60 still standing
      </p>
    </div>
  );
}
