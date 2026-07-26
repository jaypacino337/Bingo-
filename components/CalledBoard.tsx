'use client';

import { letterFor } from '@/lib/bingo';

/** The balls called so far, newest last and highlighted. */
export function CalledBoard({ draws }: { draws: number[] }) {
  const last = draws.at(-1) ?? null;

  return (
    <div className="w-full">
      <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-label text-pump-400/60">
        Called this game · {draws.length}/75
      </p>

      {draws.length === 0 ? (
        <p className="text-center text-[13px] text-pump-100/40">
          No calls yet — the cage is still filling.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {draws.map((ball, i) => {
            const isLast = i === draws.length - 1;
            return (
              <span
                key={`${ball}-${i}`}
                title={`${letterFor(ball)}-${ball}`}
                className={`flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition
                  ${
                    isLast
                      ? 'animate-ball-in bg-pump-400 text-forest-900 ring-2 ring-white/70'
                      : 'bg-white text-forest-900'
                  }`}
              >
                {ball}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * The full 1-75 board, so players can see at a glance what is still in the
 * cage. Collapsed by default on small screens.
 */
export function FullBoard({ draws }: { draws: number[] }) {
  const drawn = new Set(draws);
  const columns: number[][] = [0, 1, 2, 3, 4].map((c) =>
    Array.from({ length: 15 }, (_, i) => c * 15 + i + 1),
  );

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {columns.map((column, ci) => (
        <div key={ci} className="flex flex-col gap-1">
          <span className="mb-0.5 text-center text-[11px] font-extrabold tracking-[0.14em] text-pump-300">
            {['B', 'I', 'N', 'G', 'O'][ci]}
          </span>
          {column.map((n) => (
            <span
              key={n}
              className={`flex h-6 items-center justify-center rounded text-[10.5px] font-bold tabular-nums transition
                ${drawn.has(n) ? 'bg-pump-400 text-forest-900' : 'bg-forest-700/60 text-pump-100/30'}`}
            >
              {n}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
