'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { fighterId, type Duel, type Fighter } from '@/lib/royale';
import { shortWallet } from '@/lib/format';

/**
 * The head-to-head. Two fighters slide in, clash, and the winner is revealed
 * partway through the duel's slot — the reveal is deliberately held back a
 * beat so there is a moment of "who takes it" rather than an instant answer.
 */

const ROUND_NAMES = ['Quarter-final', 'Semi-final', 'Final'];

function roundName(round: number, total: number): string {
  // Name backwards from the final so brackets of any size read correctly.
  const fromEnd = total - 1 - round;
  return ROUND_NAMES[ROUND_NAMES.length - 1 - fromEnd] ?? `Round ${round + 1}`;
}

export function DuelStage({
  duel,
  duelIndex,
  duelCount,
  bracketRounds,
  wallet,
  revealAfterMs,
}: {
  duel: Duel;
  duelIndex: number;
  duelCount: number;
  bracketRounds: number;
  wallet: string | null;
  revealAfterMs: number;
}) {
  const [revealed, setRevealed] = useState(false);

  // Reset and re-arm the reveal for each new duel.
  useEffect(() => {
    setRevealed(false);
    const id = setTimeout(() => setRevealed(true), revealAfterMs);
    return () => clearTimeout(id);
  }, [duelIndex, revealAfterMs]);

  const winnerId = duel.winner ? fighterId(duel.winner) : null;

  return (
    <div className="w-full">
      <p className="mb-4 text-center font-mono text-[10px] uppercase tracking-label text-pump-400/60">
        {roundName(duel.round, bracketRounds)} · duel {duelIndex + 1} of {duelCount}
      </p>

      <div className="flex items-stretch justify-center gap-3 sm:gap-5">
        <FighterCard
          fighter={duel.a}
          side="left"
          revealed={revealed}
          won={revealed && winnerId === (duel.a ? fighterId(duel.a) : '')}
          mine={duel.a?.wallet === wallet}
        />

        <div className="flex shrink-0 items-center">
          <AnimatePresence mode="wait">
            {revealed ? (
              <motion.span
                key="result"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-mono text-[11px] uppercase tracking-label text-pump-300"
              >
                Out
              </motion.span>
            ) : (
              <motion.span
                key="vs"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [1, 1.18, 1], opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ duration: 0.7, repeat: Infinity }}
                className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              >
                VS
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <FighterCard
          fighter={duel.b}
          side="right"
          revealed={revealed}
          won={revealed && winnerId === (duel.b ? fighterId(duel.b) : '')}
          mine={duel.b?.wallet === wallet}
        />
      </div>
    </div>
  );
}

function FighterCard({
  fighter,
  side,
  revealed,
  won,
  mine,
}: {
  fighter: Fighter | null;
  side: 'left' | 'right';
  revealed: boolean;
  won: boolean;
  mine: boolean;
}) {
  if (!fighter) {
    return <div className="w-[38%] max-w-[190px] rounded-2xl border border-pump-500/15" />;
  }

  const lost = revealed && !won;

  return (
    <motion.div
      initial={{ x: side === 'left' ? -60 : 60, opacity: 0 }}
      animate={{
        x: 0,
        opacity: lost ? 0.32 : 1,
        scale: won ? 1.05 : lost ? 0.94 : 1,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`w-[38%] max-w-[190px] rounded-2xl border-2 p-4 text-center transition-colors
        ${
          won
            ? 'border-pump-300 bg-pump-500/20 shadow-[0_0_28px_-6px_rgba(134,239,172,0.7)]'
            : lost
              ? 'border-white/10 bg-forest-800/40'
              : 'border-pump-500/40 bg-forest-800/70'
        }`}
    >
      <p
        className={`mb-1 truncate font-mono text-[11px] ${
          won ? 'text-pump-200' : 'text-pump-100/60'
        }`}
      >
        {shortWallet(fighter.wallet, 4, 4)}
      </p>
      <p className={`text-lg font-extrabold tracking-tight ${won ? 'text-white' : 'text-white/70'}`}>
        #{String(fighter.entry + 1).padStart(3, '0')}
      </p>

      <p className="mt-2 h-4 font-mono text-[9.5px] uppercase tracking-label">
        {mine ? <span className="text-white">You</span> : null}
      </p>

      <p className="mt-1 h-4 font-mono text-[10px] uppercase tracking-label">
        {revealed ? (
          won ? (
            <span className="text-pump-300">Survives</span>
          ) : (
            <span className="text-red-300/80">Eliminated</span>
          )
        ) : null}
      </p>
    </motion.div>
  );
}
