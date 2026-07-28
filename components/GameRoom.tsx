'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Arena } from './Arena';
import { CallerPanel } from './CallerPanel';
import { DuelStage } from './DuelStage';
import { Logo } from './Logo';
import { WalletSearch } from './WalletSearch';
import { fetchHolder, joinGame, type HolderInfo } from '@/lib/api';
import { fighterId } from '@/lib/royale';
import { compactTokens, countdown, shortWallet, sol } from '@/lib/format';
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
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);

  const wallet = urlWallet ?? storedWallet;

  useEffect(() => {
    if (urlWallet && urlWallet !== storedWallet) setStoredWallet(urlWallet);
  }, [urlWallet, storedWallet, setStoredWallet]);

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
  const seated = Boolean(wallet && state?.players.some((p) => p.wallet === wallet));

  // How many of your fighters are still alive.
  const mine = useMemo(() => {
    if (!wallet || !state) return { total: 0, alive: 0 };
    const entries = state.players.find((p) => p.wallet === wallet)?.entries ?? 0;
    const dead = new Set(state.eliminated);
    let alive = 0;
    for (let entry = 0; entry < entries; entry++) {
      if (!dead.has(fighterId({ wallet, entry }))) alive++;
    }
    return { total: entries, alive };
  }, [wallet, state]);

  const join = useCallback(async () => {
    if (!wallet) return;
    setJoining(true);
    try {
      await joinGame(wallet);
    } catch (err) {
      // Kept off the page on purpose — the next lobby retries automatically.
      console.warn('[bingo] join failed:', err);
    } finally {
      setJoining(false);
    }
  }, [wallet]);

  // Auto-enter each new lobby so holders don't have to babysit the tab.
  const autoJoined = useRef<string | null>(null);
  useEffect(() => {
    if (!wallet || !state || phase !== 'lobby') return;
    if (!holder?.eligible || seated) return;
    const token = `${state.roundId ?? 'pending'}:${state.serverSeedHash}`;
    if (autoJoined.current === token) return;
    autoJoined.current = token;
    void join();
  }, [wallet, state, phase, holder, seated, join]);

  const remaining = state ? state.phaseEndsAt - now : 0;
  const showChampion =
    phase === 'champion' && state?.champion && dismissedRound !== (state?.roundId ?? -1);

  const bracketRounds = useMemo(() => {
    if (!state?.duelCount) return 3;
    return Math.max(...(state.resolvedDuels.map((d) => d.round) ?? [0]), state.currentDuel?.round ?? 0) + 1;
  }, [state]);

  const statusLabel =
    phase === 'lobby'
      ? `Next round in ${countdown(remaining)}`
      : phase === 'intro'
        ? 'Fighters entering the arena…'
        : phase === 'culling'
          ? `Wave ${state?.waveIndex ?? 0} of ${state?.waveCount ?? 0} — ${state?.aliveCount ?? 0} left`
          : phase === 'duels'
            ? 'Duels'
            : 'Champion';

  return (
    <div className="hall-glow min-h-screen bg-forest-900 text-white">
      <header className="border-b border-pump-500/15">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link href="/" className="shrink-0">
            <Logo tone="light" />
          </Link>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Stat label="This round" value={`${sol(state?.prizeLamports ?? 0)} SOL`} />
            <Stat label="Jackpot" value={`${sol(state?.jackpotLamports ?? 0)} SOL`} accent />
            <Stat label="Players" value={String(state?.playersCount ?? 0)} />
            <Stat
              label="Standing"
              value={`${state?.aliveCount ?? 0}/${state?.fightersCount ?? 0}`}
            />
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

      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr_300px]">
          {/* Referee */}
          <div className="order-2 lg:order-1">
            <CallerPanel
              headline={
                phase === 'duels' && state?.currentDuel
                  ? 'Duel'
                  : phase === 'culling'
                    ? `Wave ${state?.waveIndex ?? 0}`
                    : phase === 'champion'
                      ? 'Champion'
                      : 'Next round'
              }
              value={
                phase === 'duels' && state?.currentDuel
                  ? `${(state.currentDuel.index ?? 0) + 1}/${state.duelCount}`
                  : phase === 'culling'
                    ? `${state?.aliveCount ?? 0}`
                    : phase === 'champion' && state?.champion
                      ? shortWallet(state.champion.wallet, 4, 4)
                      : countdown(remaining)
              }
            />
          </div>

          {/* Centre stage */}
          <div className="order-1 flex min-h-[320px] flex-col items-center justify-center lg:order-2">
            <AnimatePresence mode="wait">
              {phase === 'duels' && state?.currentDuel ? (
                <motion.div
                  key={`duel-${state.currentDuel.index}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  className="w-full"
                >
                  <DuelStage
                    duel={state.currentDuel}
                    duelIndex={state.currentDuel.index}
                    duelCount={state.duelCount}
                    bracketRounds={bracketRounds}
                    wallet={wallet}
                    revealAfterMs={Math.max(600, (state.phaseEndsAt - now) * 0.45)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key={`stage-${phase}`}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="text-center"
                >
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-label text-pump-400/60">
                    {phase === 'lobby' ? 'Doors open' : 'Duel royale'}
                  </p>
                  <p className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                    {phase === 'lobby'
                      ? countdown(remaining)
                      : phase === 'intro'
                        ? `${state?.fightersCount ?? 0} enter`
                        : phase === 'culling'
                          ? `${state?.aliveCount ?? 0} left`
                          : state?.champion
                            ? shortWallet(state.champion.wallet, 4, 4)
                            : '—'}
                  </p>
                  <p className="mt-2 text-[13.5px] text-pump-100/55">
                    {phase === 'lobby'
                      ? `${state?.fightersCount ?? 0} fighters signed up so far`
                      : phase === 'intro'
                        ? 'Last one standing takes the pot'
                        : phase === 'culling'
                          ? `Wave ${state?.waveIndex ?? 0} of ${state?.waveCount ?? 0}`
                          : 'Takes the round'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
              <span className="btn-primary pointer-events-none !py-2.5 opacity-90">
                {statusLabel}
              </span>
            </div>

            <p className="mt-5 text-center font-mono text-[10px] uppercase tracking-label text-pump-400/45">
              Last standing wins · 80% winner · 20% jackpot · 1-in-{state?.jackpotOdds ?? 25} roll
            </p>
          </div>

          {/* You */}
          <div className="order-3 min-w-0">
            {wallet && holder?.eligible ? (
              <div className="rounded-2xl border border-pump-500/20 bg-forest-800/60 p-5">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-label text-pump-400/60">
                  Your squad
                </p>
                <p className="mb-1 text-2xl font-extrabold tracking-tight">
                  {mine.alive}
                  <span className="text-pump-100/40">/{mine.total || holder.cards}</span>
                </p>
                <p className="mb-4 text-[12.5px] text-pump-100/55">
                  {compactTokens(holder.amount)} ${site.symbol} ={' '}
                  {holder.cards} {holder.cards === 1 ? 'fighter' : 'fighters'}
                </p>

                {seated ? (
                  <p className="font-mono text-[10px] uppercase tracking-label text-pump-400">
                    ✓ In the round
                  </p>
                ) : phase === 'lobby' ? (
                  <button
                    type="button"
                    onClick={() => void join()}
                    disabled={joining}
                    className="btn-primary w-full"
                  >
                    {joining ? 'Entering…' : 'Enter the arena'}
                  </button>
                ) : (
                  <p className="font-mono text-[10px] uppercase tracking-label text-pump-100/50">
                    Round in progress — you&rsquo;re in the next one automatically.
                  </p>
                )}
              </div>
            ) : (
              <SeatPrompt holder={holder} wallet={wallet} />
            )}

            {state?.recentWinners.length ? (
              <div className="mt-6">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-label text-pump-400/60">
                  Recent champions
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

          {/* The floor */}
          <div className="order-4 min-w-0 lg:col-span-3">
            <Arena
              players={state?.players ?? []}
              eliminated={state?.eliminated ?? []}
              lastWave={state?.lastWave ?? []}
              wallet={wallet}
              finalists={state?.finalists ?? []}
            />
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showChampion && state?.champion ? (
          <ChampionOverlay
            wallet={wallet}
            championWallet={state.champion.wallet}
            entry={state.champion.entry}
            prize={state.championPrize}
            jackpotWon={state.jackpotWon}
            jackpotPrize={state.jackpotPrize}
            jackpotOdds={state.jackpotOdds}
            onClose={() => setDismissedRound(state.roundId ?? -1)}
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
        <p className="eyebrow-on-dark mb-2">Get in the arena</p>
        <h2 className="mb-2 text-lg font-extrabold tracking-tight">Find your fighters</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-pump-100/60">
          Paste your wallet and we&rsquo;ll pull the fighters your ${site.symbol} earned you.
          Watching is free — fighting needs a bag.
        </p>
        <WalletSearch compact />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-pump-500/20 bg-forest-800/60 p-5">
      <p className="eyebrow-on-dark mb-2">No fighters yet</p>
      <h2 className="mb-2 text-lg font-extrabold tracking-tight">
        {holder ? `${compactTokens(holder.amount)} $${site.symbol} in the bag` : 'Checking…'}
      </h2>
      {holder ? (
        <p className="mb-4 text-[13px] leading-relaxed text-pump-100/60">
          You need {holder.minTokensToPlay.toLocaleString()} ${site.symbol} for your first fighter.
          You&rsquo;re {Math.ceil(holder.toNextCard).toLocaleString()} short.
        </p>
      ) : null}
      <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary w-full">
        Buy ${site.symbol}
      </a>
    </div>
  );
}

function ChampionOverlay({
  wallet,
  championWallet,
  entry,
  prize,
  jackpotWon,
  jackpotPrize,
  jackpotOdds,
  onClose,
}: {
  wallet: string | null;
  championWallet: string;
  entry: number;
  prize: number;
  jackpotWon: boolean;
  jackpotPrize: number;
  jackpotOdds: number;
  onClose: () => void;
}) {
  const won = wallet === championWallet;

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
        <p className="eyebrow mb-2">{won ? 'That’s you' : 'Last one standing'}</p>
        <h2 className="mb-3 text-4xl font-extrabold tracking-tight text-pump-500">CHAMPION</h2>

        <p className="mb-1 font-mono text-[13px] text-forest-900/70">
          {shortWallet(championWallet, 6, 6)} · #{String(entry + 1).padStart(3, '0')}
        </p>
        <p className="mb-4 text-xl font-extrabold text-forest-900">
          {sol(prize)} SOL
          {jackpotWon ? (
            <span className="ml-2 text-pump-600">+ {sol(jackpotPrize)} JACKPOT ★</span>
          ) : null}
        </p>

        <p className="mb-5 text-[12.5px] leading-relaxed text-forest-900/60">
          {jackpotWon
            ? `The 1-in-${jackpotOdds} came in. The jackpot has been paid out and starts building again from this round's 20%.`
            : `Jackpot roll missed — the 1-in-${jackpotOdds} didn't land, so it rolls on and grows.`}
        </p>

        <button type="button" onClick={onClose} className="btn-primary w-full">
          Back to the arena
        </button>
      </motion.div>
    </motion.div>
  );
}
