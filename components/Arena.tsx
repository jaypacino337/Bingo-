'use client';

import { useMemo } from 'react';
import { fighterId, type Fighter } from '@/lib/royale';
import { shortWallet } from '@/lib/format';

/**
 * The arena floor: every entry in the round as a tile, dimming out as the
 * culling waves take them. Your own fighters are ringed so you can find
 * yourself in the crowd at a glance.
 *
 * A round can hold thousands of fighters, so tiles scale down as the field
 * grows and the grid caps what it draws rather than trying to render the lot.
 */

const MAX_TILES = 600;

export function Arena({
  players,
  eliminated,
  lastWave,
  wallet,
  finalists,
}: {
  players: { wallet: string; entries: number }[];
  eliminated: string[];
  lastWave: string[];
  wallet: string | null;
  finalists: Fighter[];
}) {
  const deadSet = useMemo(() => new Set(eliminated), [eliminated]);
  const freshSet = useMemo(() => new Set(lastWave), [lastWave]);
  const finalSet = useMemo(() => new Set(finalists.map(fighterId)), [finalists]);

  const { tiles, hidden } = useMemo(() => {
    // Your fighters first so you are always drawn, even in a huge field.
    const ordered = [...players].sort((a, b) => {
      if (a.wallet === wallet) return -1;
      if (b.wallet === wallet) return 1;
      return b.entries - a.entries;
    });

    const all: Fighter[] = [];
    for (const player of ordered) {
      for (let entry = 0; entry < player.entries; entry++) {
        all.push({ wallet: player.wallet, entry });
      }
    }
    return { tiles: all.slice(0, MAX_TILES), hidden: Math.max(0, all.length - MAX_TILES) };
  }, [players, wallet]);

  if (tiles.length === 0) {
    return (
      <div className="rounded-2xl border border-pump-500/20 bg-forest-800/40 px-5 py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-label text-pump-400/60">
          The arena is empty
        </p>
        <p className="mt-1.5 text-[13px] text-pump-100/45">
          Fighters appear here as holders enter the next round.
        </p>
      </div>
    );
  }

  // Shrink the tiles as the crowd grows so the whole field stays on screen.
  const size = tiles.length > 300 ? 'h-3 w-3' : tiles.length > 120 ? 'h-4 w-4' : 'h-6 w-6';

  return (
    <div className="rounded-2xl border border-pump-500/20 bg-forest-800/40 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-label text-pump-400/60">
          The arena
        </p>
        <p className="font-mono text-[10px] uppercase tracking-label text-pump-100/30">
          {tiles.length - [...deadSet].filter((id) => tiles.some((t) => fighterId(t) === id)).length}{' '}
          still standing
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {tiles.map((fighter) => {
          const id = fighterId(fighter);
          const dead = deadSet.has(id);
          const justDied = freshSet.has(id);
          const isFinalist = finalSet.has(id);
          const mine = fighter.wallet === wallet;

          return (
            <span
              key={id}
              title={`${shortWallet(fighter.wallet)} · #${fighter.entry + 1}`}
              className={`${size} rounded-[3px] transition-all duration-500
                ${
                  justDied
                    ? 'scale-125 bg-red-400/70'
                    : dead
                      ? 'scale-90 bg-pump-100/15'
                      : isFinalist
                        ? 'animate-pulse bg-pump-300 shadow-[0_0_8px_rgba(134,239,172,0.8)]'
                        : 'bg-pump-500/80'
                }
                ${mine && !dead ? 'ring-2 ring-white ring-offset-1 ring-offset-forest-800' : ''}`}
            />
          );
        })}
      </div>

      {hidden > 0 ? (
        <p className="mt-3 text-center font-mono text-[9.5px] uppercase tracking-label text-pump-100/30">
          + {hidden} more fighters in the round, not shown
        </p>
      ) : null}
    </div>
  );
}
