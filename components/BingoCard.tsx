'use client';

import { COLUMN_LETTERS, type Card } from '@/lib/bingo';

/** The little diamond in the free centre square. */
function FreeDiamond({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M4 9.5 L12 19 L20 9.5 L17 5 L7 5 Z"
        fill="#F3FBF6"
        stroke="#04140C"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M7 5 L9.6 9.5 L12 19 L14.4 9.5 L17 5" fill="none" stroke="#04140C" strokeWidth="1.2" />
      <path d="M4 9.5 H20" stroke="#04140C" strokeWidth="1.2" />
    </svg>
  );
}

export interface BingoCardProps {
  card: Card;
  /** Numbers called so far. */
  drawn?: ReadonlySet<number>;
  /** The most recent ball, drawn with a highlight ring. */
  lastBall?: number | null;
  /** Squares belonging to a completed winning line. */
  winningLine?: [number, number][];
  label?: string;
  footer?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { cell: 'h-8 text-[13px]', head: 'py-1.5 text-[11px]', daub: 'h-6 w-6 text-[12px]' },
  md: { cell: 'h-11 text-[15px]', head: 'py-2 text-[12px]', daub: 'h-8 w-8 text-[14px]' },
  lg: { cell: 'h-14 text-[19px]', head: 'py-2.5 text-[13px]', daub: 'h-11 w-11 text-[18px]' },
} as const;

export function BingoCard({
  card,
  drawn,
  lastBall = null,
  winningLine,
  label,
  footer,
  size = 'md',
  className = '',
}: BingoCardProps) {
  const s = SIZES[size];
  const winSet = new Set((winningLine ?? []).map(([c, r]) => `${c}:${r}`));

  return (
    <div
      className={`overflow-hidden rounded-2xl border-2 border-forest-900 bg-white shadow-card ${className}`}
    >
      {label ? (
        <div className="border-b border-forest-900/10 bg-mint-50 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-label text-forest-700">
          {label}
        </div>
      ) : null}

      {/* B I N G O header */}
      <div className="grid grid-cols-5 bg-forest-800">
        {COLUMN_LETTERS.map((letter) => (
          <div
            key={letter}
            className={`text-center font-extrabold tracking-[0.14em] text-pump-300 ${s.head}`}
          >
            {letter}
          </div>
        ))}
      </div>

      {/* 5x5 grid, rendered row by row so it reads left-to-right */}
      <div className="grid grid-cols-5">
        {[0, 1, 2, 3, 4].map((row) =>
          [0, 1, 2, 3, 4].map((col) => {
            const value = card[col]?.[row];
            const isFree = value === null || value === undefined;
            const isDaubed = !isFree && (drawn?.has(value) ?? false);
            const isLast = !isFree && value === lastBall;
            const inWin = winSet.has(`${col}:${row}`);

            return (
              <div
                key={`${col}-${row}`}
                className={`relative flex items-center justify-center border-b border-r border-forest-900/12 font-bold tabular-nums
                  ${col === 4 ? 'border-r-0' : ''} ${row === 4 ? 'border-b-0' : ''}
                  ${inWin ? 'bg-pump-100' : 'bg-white'} ${s.cell}`}
              >
                {isFree ? (
                  <span className="flex h-full w-full items-center justify-center bg-pump-400">
                    <FreeDiamond className={size === 'lg' ? 'h-7 w-7' : 'h-5 w-5'} />
                  </span>
                ) : isDaubed ? (
                  <span
                    key={`daub-${value}`}
                    className={`flex animate-daub-in items-center justify-center rounded-full font-extrabold
                      ${
                        isLast
                          ? 'bg-pump-400 text-forest-900 ring-2 ring-forest-900'
                          : 'bg-pump-300 text-forest-900'
                      } ${s.daub}`}
                  >
                    {value}
                  </span>
                ) : (
                  <span className="text-forest-900/85">{value}</span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {footer ? (
        <div className="border-t border-forest-900/10 bg-mint-50 px-3 py-2 text-center font-mono text-[10px] uppercase tracking-label text-forest-700">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A card at a glance — no numbers, just daubed/undaubed squares. Used for the
 * wall of every entrant in the hall, where hundreds may be on screen at once.
 */
export function MiniCard({
  card,
  drawn,
  toGo,
  mine = false,
  won = false,
  onClick,
}: {
  card: Card;
  drawn: ReadonlySet<number>;
  toGo: number;
  mine?: boolean;
  won?: boolean;
  onClick?: () => void;
}) {
  const cells = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const value = card[col]?.[row];
      const free = value === null || value === undefined;
      const daubed = free || drawn.has(value);
      cells.push(
        <span
          key={`${col}-${row}`}
          className={`rounded-[1.5px] ${
            free ? 'bg-pump-500' : daubed ? 'bg-pump-300' : 'bg-white/22'
          }`}
        />,
      );
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative rounded-md border p-[3px] transition
        ${
          won
            ? 'border-pump-300 bg-pump-500/30 ring-2 ring-pump-300'
            : mine
              ? 'border-pump-400 bg-forest-700/70'
              : 'border-pump-500/20 bg-forest-800/60 hover:border-pump-400/60'
        }`}
      title={`${toGo} to go`}
    >
      <span className="grid grid-cols-5 gap-[1.5px]">{cells}</span>
      {/* Balls still needed — the lower the hotter. */}
      <span
        className={`absolute -right-1 -top-1 flex h-[13px] min-w-[13px] items-center justify-center rounded-full px-[3px] text-[8px] font-bold tabular-nums
          ${
            toGo === 0
              ? 'bg-pump-300 text-forest-900'
              : toGo <= 3
                ? 'bg-pump-400 text-forest-900'
                : 'bg-forest-600 text-pump-100/70'
          }`}
      >
        {toGo}
      </span>
    </button>
  );
}

/**
 * The hero card — same grid, wrapped in the dark punch-card frame with the
 * little holes down the edges.
 */
export function FramedCard(props: BingoCardProps) {
  return (
    <div className="rounded-[26px] border-2 border-forest-900 bg-forest-800 p-3 shadow-card">
      <div className="flex items-center justify-between px-2 pb-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-pump-400/50" />
        ))}
      </div>
      <BingoCard {...props} className="shadow-none" />
      <div className="flex items-center justify-between px-2 pt-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-pump-400/50" />
        ))}
      </div>
    </div>
  );
}
