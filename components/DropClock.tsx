'use client';

import { CashCow } from './CashCow';
import { sol } from '@/lib/format';
import { useDrop, useNow } from '@/lib/useGame';

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The centrepiece: how long until the next drop, what's in the pot, and the
 * cow going wild while one is being sent.
 */
export function DropClock() {
  const { state } = useDrop();
  const now = useNow(250);

  const sending = state?.phase === 'sending' || state?.phase === 'snapshotting';
  const remaining = state ? state.nextRunAt - now : 0;

  const headline = !state
    ? '—'
    : sending
      ? 'DROPPING'
      : clock(remaining);

  const caption = !state
    ? 'Waking the cow…'
    : state.phase === 'snapshotting'
      ? 'Taking the snapshot…'
      : state.phase === 'sending'
        ? state.progress
          ? `Paying ${state.progress.sent} of ${state.progress.total} holders…`
          : 'Sending…'
        : 'Until the next drop';

  return (
    <div className="flex flex-col items-center text-center">
      <CashCow className="w-[280px] sm:w-[340px]" spraying={sending} />

      <p className="label mt-2">{caption}</p>
      <p
        className={`mt-1 text-[60px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[78px] ${
          sending ? 'animate-pulse text-cash-500' : 'text-ink'
        }`}
      >
        {headline}
      </p>

      <div className="mt-7 grid w-full max-w-lg grid-cols-3 gap-3">
        <Tile label="In the pot" value={`${sol(state?.pendingPoolLamports ?? 0)} SOL`} big />
        <Tile label="Holders" value={String(state?.holderCount ?? 0)} />
        <Tile label="Paid out" value={`${sol(state?.totalPaidLamports ?? 0)} SOL`} />
      </div>
    </div>
  );
}

function Tile({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div
      className={`rounded-2xl border-2 border-ink px-3 py-3.5 ${
        big ? 'bg-cash-400' : 'bg-white'
      } shadow-lift`}
    >
      <p className="font-mono text-[9.5px] uppercase tracking-label text-ink/55">{label}</p>
      <p className="mt-0.5 truncate text-[17px] font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
