'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BingoCard } from './BingoCard';
import { CageScene } from './CageScene';
import { CallerPanel } from './CallerPanel';
import { CalledBoard, FullBoard } from './CalledBoard';
import { CardWall } from './CardWall';
import { Logo } from './Logo';
import { WalletSearch } from './WalletSearch';
import { fetchHolder, joinGame, type HolderInfo } from '@/lib/api';
import { evaluateCard, generateCard } from '@/lib/bingo';
import { compactTokens, countdown, patternLabel, shortWallet, sol } from '@/lib/format';
import { buyUrl, site } from '@/lib/site';
import { useGame, useNow, useStoredWallet } from '@/lib/useGame';

/**
 * Reads ?w= straight off the URL rather than via useSearchParams, so this
 * component has no dependency on Next's routing internals — it is mounted
 * client-only and needs to work without a Suspense boundary.
 */
function useWalletParam(): string | null {
  const [wallet, setWallet] = useState<string | null>(null);
  useEffect(() => {
    setWallet(new URLSearchParams(window.location.search).get('w'));
  }, []);
  return wallet;
}

export function GameRoom() {
  const urlWallet = useWalletParam();
  const { state, connection } = useGame();
  const now = useNow(250);
  const [storedWallet, setStoredWallet] = useStoredWallet();

  const [holder, setHolder] = useState<HolderInfo | null>(null);
  const [joining, setJoining] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);

  // ?w= wins over whatever is in storage, so shared links work.
  const wallet = urlWallet ?? storedWallet;

  useEffect(() => {
    if (urlWallet && urlWallet !== storedWallet) setStoredWallet(urlWallet);
  }, [urlWallet, storedWallet, setStoredWallet]);

  // Load holdings for whoever is at the table.
  useEffect(() => {
    if (!wallet) {
      setHolder(null);
      return;
    }
    let cancelled = false;
    fetchHolder(wallet)
      .then((info) => {
        if (!cancelled) setHolder(info);
      })
      .catch(() => {
        if (!cancelled) setHolder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const phase = state?.phase ?? 'lobby';
  const draws = useMemo(() => state?.draws ?? [], [state?.draws]);
  const drawn = useMemo(() => new Set(draws), [draws]);
  const pattern = state?.pattern ?? 'full';

  const seated = Boolean(
    wallet && state?.players.some((p) => p.wallet === wallet),
  );

  const cardCount = holder?.cards ?? 0;
  const cards = useMemo(() => {
    if (!wallet || cardCount === 0) return [];
    return Array.from({ length: cardCount }, (_, i) => generateCard(wallet, i));
  }, [wallet, cardCount]);

  // Keep the shown card on the one closest to winning — that's the one you
  // actually want your eyes on.
  const ranked = useMemo(() => {
    return cards
      .map((card, index) => ({ index, remaining: evaluateCard(card, drawn, pattern).remaining }))
      .sort((a, b) => a.remaining - b.remaining);
  }, [cards, drawn, pattern]);

  const bestIndex = ranked[0]?.index ?? 0;
  const followBest = useRef(true);
  useEffect(() => {
    if (followBest.current) setActiveCard(bestIndex);
  }, [bestIndex]);

  const selectCard = useCallback((index: number) => {
    followBest.current = false;
    setActiveCard(index);
  }, []);

  // --- joining -------------------------------------------------------------
  const join = useCallback(async () => {
    if (!wallet) return;
    setJoining(true);
    try {
      await joinGame(wallet);
    } catch (err) {
      // Kept off the page on purpose — the seat button simply stays available
      // and the next lobby retries. Details go to the console for debugging.
      console.warn('[bingo] join failed:', err);
    } finally {
      setJoining(false);
    }
  }, [wallet]);

  // Auto-seat on arrival and at the top of every new lobby, so holders don't
  // have to babysit the tab to stay in the game.
  const autoJoinedRound = useRef<string | null>(null);
  useEffect(() => {
    if (!wallet || !state || phase !== 'lobby') return;
    if (!holder?.eligible) return;
    if (seated) return;
    const token = `${state.roundId ?? 'pending'}:${state.serverSeedHash}`;
    if (autoJoinedRound.current === token) return;
    autoJoinedRound.current = token;
    void join();
  }, [wallet, state, phase, holder, seated, join]);

  const winners = state?.winners ?? [];
  const showWinner =
    phase === 'celebration' && winners.length > 0 && dismissedRound !== (state?.roundId ?? -1);

  const youWon = winners.filter((w) => w.wallet === wallet);
  const remaining = state ? state.phaseEndsAt - now : 0;

  const statusLabel =
    phase === 'lobby'
      ? `Next game in ${countdown(remaining)}`
      : phase === 'preroll'
        ? 'Eyes down…'
        : phase === 'drawing'
          ? `Drawing · ${draws.length} called`
          : 'House!';

  return (
    <div className="hall-glow min-h-screen bg-forest-900 text-white">
      {/* ------------------------------------------------------------------ */}
      {/* Top bar                                                            */}
      {/* ------------------------------------------------------------------ */}
      <header className="border-b border-pump-500/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="shrink-0">
            <Logo tone="light" />
          </Link>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Stat label="This game" value={`${sol(state?.prizeLamports ?? 0)} SOL`} />
            <Stat label="Jackpot" value={`${sol(state?.jackpotLamports ?? 0)} SOL`} accent />
            <Stat label="Players" value={String(state?.playersCount ?? 0)} />
            <Stat label="Cards" value={String(state?.cardsCount ?? 0)} />
          </div>

          <div className="flex items-center gap-2">
            {state?.demoMode ? (
              <span className="rounded-md border border-pump-500/30 px-2 py-1 font-mono text-[9px] uppercase tracking-label text-pump-100/50">
                Test game
              </span>
            ) : null}
            <span
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-label ${
                connection === 'live' ? 'text-pump-400' : 'text-pump-100/45'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connection === 'live' ? 'bg-pump-400' : 'animate-pulse bg-pump-100/40'
                }`}
              />
              {connection === 'live' ? 'Live' : 'Connecting'}
            </span>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* The hall                                                           */}
      {/* ------------------------------------------------------------------ */}
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr_320px]">
          {/* Caller */}
          <div className="order-2 lg:order-1">
            <CallerPanel ball={state?.lastBall ?? null} />
          </div>

          {/* Cage */}
          <div className="order-1 flex flex-col items-center lg:order-2">
            <CageScene
              spinKey={draws.length}
              speed={phase === 'drawing' || phase === 'preroll' ? 1 : 0.35}
              className="h-[260px] w-full sm:h-[320px]"
            />

            <div className="mt-2 w-full">
              <CalledBoard draws={draws} />
            </div>

            {/* Controls */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="btn-primary pointer-events-none !py-2.5 opacity-90">
                {statusLabel}
              </span>
              <button
                type="button"
                onClick={() => setShowBoard((v) => !v)}
                className="btn-ghost !py-2.5"
              >
                {showBoard ? 'Hide board' : 'Full board'}
              </button>
            </div>

            <AnimatePresence>
              {showBoard ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="w-full overflow-hidden"
                >
                  <div className="mt-5 rounded-2xl border border-pump-500/20 bg-forest-800/60 p-4">
                    <FullBoard draws={draws} />
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-label text-pump-400/45">
              {patternLabel(pattern)} pays · 80% winner · 20% jackpot · 1-in-
              {state?.jackpotOdds ?? 25} roll
            </p>
          </div>

          {/* The floor — every entrant's cards, full width under the cage. */}
          <div className="order-4 min-w-0 lg:col-span-3">
            <CardWall
              players={state?.players ?? []}
              drawn={drawn}
              pattern={pattern}
              wallet={wallet}
              lastBall={state?.lastBall ?? null}
              winners={winners}
            />
          </div>

          {/* Your cards */}
          <div className="order-3 min-w-0">
            {wallet && holder?.eligible && cards.length > 0 ? (
              <>
                <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-label text-pump-400/60 lg:text-left">
                  Your card · {compactTokens(holder.amount)} ${site.symbol} ={' '}
                  {holder.cards} {holder.cards === 1 ? 'entry' : 'entries'}
                </p>

                <BingoCard
                  card={cards[activeCard] ?? cards[0]!}
                  drawn={drawn}
                  lastBall={state?.lastBall ?? null}
                  winningLine={
                    youWon.find((w) => w.cardIndex === activeCard)?.line ??
                    evaluateCard(cards[activeCard] ?? cards[0]!, drawn, pattern).completed[0]
                  }
                  footer={`Card #${String(activeCard + 1).padStart(3, '0')} · ${shortWallet(wallet)}`}
                />

                {cards.length > 1 ? (
                  <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto pb-1">
                    {ranked.map(({ index, remaining: togo }) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectCard(index)}
                        className={`shrink-0 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] transition
                          ${
                            index === activeCard
                              ? 'border-pump-400 bg-pump-400 text-forest-900'
                              : 'border-pump-500/25 bg-forest-800 text-pump-100/70 hover:border-pump-400/60'
                          }`}
                        title={`${togo} to go`}
                      >
                        #{String(index + 1).padStart(3, '0')}
                        <span className="ml-1 opacity-70">{togo}</span>
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-pump-500/20 bg-forest-800/60 p-3.5">
                  {seated ? (
                    <p className="font-mono text-[10px] uppercase tracking-label text-pump-400">
                      ✓ Seated · {holder.cards} card{holder.cards === 1 ? '' : 's'} in play
                    </p>
                  ) : phase === 'lobby' ? (
                    <button
                      type="button"
                      onClick={() => void join()}
                      disabled={joining}
                      className="btn-primary w-full"
                    >
                      {joining ? 'Taking your seat…' : 'Take your seat'}
                    </button>
                  ) : (
                    <p className="font-mono text-[10px] uppercase tracking-label text-pump-100/50">
                      Game in progress — you&rsquo;re seated automatically for the next one.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <SeatPrompt holder={holder} wallet={wallet} />
            )}

            {/* Recent winners */}
            {state?.recentWinners.length ? (
              <div className="mt-6">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-label text-pump-400/60">
                  Recent houses
                </p>
                <ul className="space-y-1.5">
                  {state.recentWinners.slice(0, 6).map((w, i) => (
                    <li
                      key={`${w.roundId}-${w.wallet}-${i}`}
                      className="flex items-center justify-between rounded-lg border border-pump-500/15 bg-forest-800/50 px-3 py-2"
                    >
                      <span className="font-mono text-[11px] text-pump-100/70">
                        {shortWallet(w.wallet)}
                        {w.jackpotWon ? <span className="ml-1.5 text-pump-400">★</span> : null}
                      </span>
                      <span className="font-mono text-[11px] font-bold tabular-nums text-pump-300">
                        {sol(w.prizeLamports + w.jackpotLamports)} SOL
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Winner overlay                                                     */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {showWinner ? (
          <WinnerOverlay
            winners={winners}
            wallet={wallet}
            jackpotOdds={state?.jackpotOdds ?? 25}
            onClose={() => setDismissedRound(state?.roundId ?? -1)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="stat-label">{label}</p>
      <p
        className={`text-[15px] font-extrabold tabular-nums ${
          accent ? 'text-pump-400' : 'text-white'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SeatPrompt({ holder, wallet }: { holder: HolderInfo | null; wallet: string | null }) {
  if (!wallet) {
    return (
      <div className="rounded-2xl border border-pump-500/20 bg-forest-800/60 p-5">
        <p className="eyebrow-on-dark mb-2">Take a seat</p>
        <h2 className="mb-2 text-lg font-extrabold tracking-tight">Find your book of cards</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-pump-100/60">
          Paste your wallet and we&rsquo;ll pull the cards your ${site.symbol} earned you. Watching
          is free — playing needs a card.
        </p>
        <WalletSearch compact />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pump-500/20 bg-forest-800/60 p-5">
      <p className="eyebrow-on-dark mb-2">No cards yet</p>
      <h2 className="mb-2 text-lg font-extrabold tracking-tight">
        {holder ? `${compactTokens(holder.amount)} $${site.symbol} in the bag` : 'Checking your bag…'}
      </h2>
      {holder ? (
        <p className="mb-4 text-[13px] leading-relaxed text-pump-100/60">
          You need {holder.minTokensToPlay.toLocaleString()} ${site.symbol} for your first card.
          You&rsquo;re {Math.ceil(holder.toNextCard).toLocaleString()} short.
        </p>
      ) : null}
      <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary w-full">
        Buy ${site.symbol}
      </a>
    </div>
  );
}

function WinnerOverlay({
  winners,
  wallet,
  jackpotOdds,
  onClose,
}: {
  winners: { wallet: string; cardIndex: number; prizeLamports: number; jackpotWon: boolean; jackpotLamports: number }[];
  wallet: string | null;
  jackpotOdds: number;
  onClose: () => void;
}) {
  const mine = winners.filter((w) => w.wallet === wallet);
  const won = mine.length > 0;
  const jackpot = winners.filter((w) => w.jackpotWon);

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-forest-950/85 backdrop-blur-sm" />

      <motion.div
        className="relative w-full max-w-sm rounded-2xl border-2 border-forest-900 bg-white p-7 text-center shadow-card"
        initial={{ scale: 0.6, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Plain string, not JSX text — an HTML entity here renders literally. */}
        <p className="eyebrow mb-2">{won ? 'That’s you' : 'House called'}</p>
        <h2 className="mb-3 text-4xl font-extrabold tracking-tight text-pump-500">HOUSE!</h2>

        <ul className="mb-4 space-y-1.5">
          {winners.map((w, i) => (
            <li key={`${w.wallet}-${w.cardIndex}-${i}`} className="text-[13px]">
              <span className="font-mono text-forest-900/70">{shortWallet(w.wallet)}</span>
              <span className="mx-1.5 text-forest-900/30">·</span>
              <span className="font-bold text-forest-900">{sol(w.prizeLamports)} SOL</span>
              {w.jackpotWon ? (
                <span className="ml-1.5 font-bold text-pump-600">
                  + {sol(w.jackpotLamports)} JACKPOT ★
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="mb-5 text-[12.5px] leading-relaxed text-forest-900/60">
          {jackpot.length > 0
            ? `The 1-in-${jackpotOdds} came in. The progressive jackpot has been paid out and starts building again from this game's 20%.`
            : `Jackpot roll missed — the 1-in-${jackpotOdds} didn't land, so the jackpot rolls on and grows.`}
        </p>

        <button type="button" onClick={onClose} className="btn-primary w-full">
          Back to the hall
        </button>
      </motion.div>
    </motion.div>
  );
}
