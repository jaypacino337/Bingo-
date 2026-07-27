import Link from 'next/link';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Marquee } from '@/components/Marquee';
import { FramedCard } from '@/components/BingoCard';
import { WalletSearch } from '@/components/WalletSearch';
import { LivePot } from '@/components/LivePot';
import { generateCard } from '@/lib/bingo';
import { fullTokens } from '@/lib/format';
import { buyUrl, site, maxCards, ENTRY_TIERS } from '@/lib/site';

// A fixed showcase card for the hero — deterministic, so it never flickers
// between server and client render.
const HERO_CARD = generateCard('bingo.fun-hero', 0);

const STEPS = [
  {
    step: 'Step 01 — Hold',
    title: `Buy and hold $${site.symbol}`,
    body: `Every ${fullTokens(site.tokensPerCard)} $${site.symbol} in your wallet at the game snapshot equals one entry. Hold ${fullTokens(site.tokensPerCard * 10)}? That's ten cards in play. No staking, no claiming — just hold.`,
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="1.8" stroke="currentColor">
        <rect x="2" y="6" width="20" height="12" rx="2.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M5 9v6M19 9v6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: 'Step 02 — The draw',
    title: 'The cage spins',
    body: 'Each game, numbers are drawn live and verifiably on-chain. Your entries are matched against the draw automatically — eyes down, the calls do the rest.',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="1.8" stroke="currentColor">
        <circle cx="11" cy="10" r="7" />
        <ellipse cx="11" cy="10" rx="3" ry="7" />
        <path d="M4 10h14M18 10l3-2M11 17v4M7 21h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    step: 'Step 03 — House!',
    title: 'Winner takes the fees',
    body: `Every creator fee earned on pump.fun during the game period goes into that game's pot. First to a full house takes 80% — and rolls a 1-in-25 shot at the jackpot on top.`,
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" strokeWidth="1.8" stroke="currentColor">
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" strokeLinecap="round" />
        <path d="M12 14v4M8 21h8l-1-3H9l-1 3Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const POT_STATS = [
  {
    value: '80/20',
    label: 'Pot split',
    body: 'Eighty percent of every pot goes straight to the winner of that game. The other twenty rolls into the progressive jackpot, which keeps climbing until someone hits it.',
  },
  {
    value: '1M',
    label: 'Tokens per entry',
    body: `The only rule of entry. Hold ${fullTokens(site.tokensPerCard)}, you're in the game. Hold more, you're in it more.`,
  },
  {
    value: '1-in-25',
    label: 'Jackpot roll',
    body: 'Every game winner rolls for the jackpot after they shout house. Hit it and the whole progressive pot is yours on top of your winnings.',
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
                Old school. On-chain. On pump.fun
              </p>

              <h1 className="h-display mb-5">
                Eyes down.
                <br />
                <span className="text-pump-500">Fees up.</span>
              </h1>

              <p className="mb-7 max-w-lg text-[15px] leading-relaxed text-forest-900/70">
                The classic hall game, rebuilt on Solana. Hold ${site.symbol} to get your cards —
                every {fullTokens(site.tokensPerCard)} tokens is one entry. Numbers get drawn,
                someone shouts house, and the winner takes every creator fee earned that game.
              </p>

              <div className="mb-4">
                <p className="eyebrow mb-2">Check your book</p>
                <WalletSearch />
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
                  Buy ${site.symbol}
                </a>
                <a href="#how-it-works" className="btn-ghost">
                  How it works
                </a>
              </div>
            </div>

            <div className="mx-auto w-full max-w-[380px]">
              <FramedCard
                card={HERO_CARD}
                size="md"
                footer="Card #001 · every 1M tokens earns another"
              />
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
              No tickets, no dabbers, no draughty community hall. Your wallet is your book of cards —
              the more ${site.symbol} you hold, the more cards you play every single game.
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
            <p className="eyebrow mb-4">Entries</p>
            <h2 className="h-display mb-10 max-w-xl">Your bag is your book of cards.</h2>

            <div className="grid items-start gap-10 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border-2 border-forest-900 shadow-lift">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-forest-800">
                      <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-label text-pump-300">
                        ${site.symbol} held
                      </th>
                      <th className="px-5 py-3 font-mono text-[10px] uppercase tracking-label text-pump-300">
                        Entries per game
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENTRY_TIERS.map((tier, i) => (
                      <tr
                        key={tier.held}
                        className={i % 2 === 0 ? 'bg-white' : 'bg-mint-100'}
                      >
                        <td className="border-t border-forest-900/10 px-5 py-3.5 font-mono text-[13px] font-medium tabular-nums text-forest-900">
                          {fullTokens(tier.held)}
                        </td>
                        <td className="border-t border-forest-900/10 px-5 py-3.5 font-mono text-[13px] font-bold tabular-nums text-pump-600">
                          {tier.cards} card{tier.cards === 1 ? '' : 's'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="mb-3 text-xl font-extrabold tracking-tight">
                  Simple maths, no small print.
                </h3>
                <p className="mb-4 text-[14px] leading-relaxed text-forest-900/70">
                  One entry per {fullTokens(site.tokensPerCard)} ${site.symbol}, straight line, no
                  tiers to memorise. A snapshot is taken at the start of each game — whatever&rsquo;s
                  in your wallet at that moment is how many cards you&rsquo;re playing.
                </p>
                <p className="mb-5 text-[14px] leading-relaxed text-forest-900/70">
                  Sell before the snapshot and you&rsquo;re playing fewer cards. Hold through it and
                  every game is another free go at the pot. Cards are capped at {maxCards} per
                  wallet, in line with the 5% max holding — nobody buys the room.
                </p>
                <div className="rounded-xl border-2 border-pump-500/30 bg-mint-100 p-4">
                  <p className="text-[13.5px] leading-relaxed text-forest-700">
                    Every game is free to enter for holders. The house doesn&rsquo;t win here — the
                    winner does.
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
            <h2 className="h-display mb-4 max-w-xl text-white">Creator fees in. One winner out.</h2>
            <p className="mb-8 max-w-2xl text-[15px] leading-relaxed text-pump-100/70">
              Every trade of ${site.symbol} on pump.fun earns creator fees. From the first call to
              the winning shout, all of it stacks into the live pot on screen.
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
              The next game is filling.
              <br />
              <span className="text-pump-500">Got your card?</span>
            </h2>
            <p className="mb-7 text-[15px] text-forest-900/70">
              Hold {fullTokens(site.tokensPerCard)} ${site.symbol} and you&rsquo;re automatically in
              every game. Eyes down.
            </p>
            <div className="flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
                Buy ${site.symbol} on pump.fun
              </a>
              <Link href="/play" className="btn-ghost">
                Watch the hall
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
