'use client';

import Link from 'next/link';
import { useGame, useNow } from '@/lib/useGame';
import { countdown, sol } from '@/lib/format';

const PHASE_COPY = {
  lobby: 'Filling now',
  preroll: 'Eyes down',
  drawing: 'Cage spinning',
  celebration: 'House!',
} as const;

/** Live strip: what the pot is doing right now, straight from the hall. */
export function LivePot({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { state, connection } = useGame();
  const now = useNow(500);

  const dark = tone === 'dark';
  const border = dark ? 'border-pump-500/25' : 'border-forest-900/12';
  const label = dark ? 'text-pump-400/70' : 'text-forest-700/70';
  const value = dark ? 'text-white' : 'text-forest-900';

  if (!state) {
    return (
      <div className={`rounded-2xl border ${border} px-5 py-4`}>
        <p className={`font-mono text-[10px] uppercase tracking-label ${label}`}>
          {connection === 'down' ? 'Hall offline' : 'Connecting to the hall…'}
        </p>
      </div>
    );
  }

  const remaining = state.phaseEndsAt - now;

  const stats = [
    { label: 'This game', value: `${sol(state.prizeLamports)} SOL` },
    { label: 'Jackpot', value: `${sol(state.jackpotLamports)} SOL` },
    { label: 'Cards in play', value: String(state.cardsCount) },
    {
      label: PHASE_COPY[state.phase],
      value: state.phase === 'lobby' ? countdown(remaining) : `${state.ballsCalled} called`,
    },
  ];

  return (
    <div className={`flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border ${border} px-5 py-4`}>
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className={`font-mono text-[10px] uppercase tracking-label ${label}`}>{stat.label}</p>
          <p className={`text-lg font-extrabold tabular-nums ${value}`}>{stat.value}</p>
        </div>
      ))}
      <Link href="/play" className="btn-primary ml-auto !px-4 !py-2.5">
        Watch live
      </Link>
    </div>
  );
}
