'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BingoCard, MiniCard } from './BingoCard';
import { evaluateCard, generateCard, type WinPattern } from '@/lib/bingo';
import { shortWallet } from '@/lib/format';

/** Rendering every card of a very large hall would jam the tab. */
const MAX_CARDS = 400;

interface WallCard {
  wallet: string;
  cardIndex: number;
  toGo: number;
  mine: boolean;
  won: boolean;
}

/**
 * The floor of the hall: every eligible entrant's cards, small, so you can
 * watch the whole room fill in at once. Your own cards are ringed and pulled
 * to the front, and clicking any card opens it full size.
 */
export function CardWall({
  players,
  drawn,
  pattern,
  wallet,
  lastBall,
  winners,
}: {
  players: { wallet: string; cards: number }[];
  drawn: ReadonlySet<number>;
  pattern: WinPattern;
  wallet: string | null;
  lastBall: number | null;
  winners: { wallet: string; cardIndex: number }[];
}) {
  const [focused, setFocused] = useState<WallCard | null>(null);
  const mineRef = useRef<HTMLDivElement | null>(null);
  const scrolledFor = useRef<string | null>(null);

  const winnerKeys = useMemo(
    () => new Set(winners.map((w) => `${w.wallet}:${w.cardIndex}`)),
    [winners],
  );

  // Build the wall: your cards first, then everyone else's, hottest first.
  const { cards, truncated, totalCards } = useMemo(() => {
    const mineFirst = [...players].sort((a, b) => {
      if (a.wallet === wallet) return -1;
      if (b.wallet === wallet) return 1;
      return b.cards - a.cards;
    });

    const total = players.reduce((sum, p) => sum + p.cards, 0);
    const out: WallCard[] = [];

    for (const player of mineFirst) {
      for (let i = 0; i < player.cards; i++) {
        if (out.length >= MAX_CARDS) break;
        const card = generateCard(player.wallet, i);
        out.push({
          wallet: player.wallet,
          cardIndex: i,
          toGo: evaluateCard(card, drawn, pattern).remaining,
          mine: player.wallet === wallet,
          won: winnerKeys.has(`${player.wallet}:${i}`),
        });
      }
    }

    return { cards: out, truncated: total - out.length, totalCards: total };
  }, [players, drawn, pattern, wallet, winnerKeys]);

  // When you arrive from a wallet search, take me to my cards.
  useEffect(() => {
    if (!wallet || !mineRef.current) return;
    if (scrolledFor.current === wallet) return;
    scrolledFor.current = wallet;
    mineRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [wallet, cards.length]);

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-pump-500/20 bg-forest-800/40 px-5 py-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-label text-pump-400/60">
          The hall is empty
        </p>
        <p className="mt-1.5 text-[13px] text-pump-100/45">
          Cards appear here the moment holders take their seats.
        </p>
      </div>
    );
  }

  // Group consecutive cards by wallet so each entrant reads as one block.
  const groups: { wallet: string; mine: boolean; items: WallCard[] }[] = [];
  for (const card of cards) {
    const last = groups.at(-1);
    if (last && last.wallet === card.wallet) last.items.push(card);
    else groups.push({ wallet: card.wallet, mine: card.mine, items: [card] });
  }

  return (
    <>
      <div className="rounded-2xl border border-pump-500/20 bg-forest-800/40 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-label text-pump-400/60">
            The floor · {players.length} {players.length === 1 ? 'entrant' : 'entrants'} ·{' '}
            {totalCards} cards
          </p>
          <p className="font-mono text-[9.5px] uppercase tracking-label text-pump-100/30">
            Number = balls to go · click to open
          </p>
        </div>

        <div className="no-scrollbar max-h-[340px] overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {groups.map((group, gi) => (
              <div
                key={`${group.wallet}-${gi}`}
                ref={group.mine && gi === 0 ? mineRef : undefined}
                className={`rounded-lg px-2 py-1.5 ${
                  group.mine ? 'bg-pump-500/10 ring-1 ring-pump-400/40' : ''
                }`}
              >
                <p
                  className={`mb-1.5 font-mono text-[9px] uppercase tracking-label ${
                    group.mine ? 'text-pump-300' : 'text-pump-100/35'
                  }`}
                >
                  {group.mine ? 'You · ' : ''}
                  {shortWallet(group.wallet, 4, 4)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map((card) => (
                    <MiniCard
                      key={`${card.wallet}-${card.cardIndex}`}
                      card={generateCard(card.wallet, card.cardIndex)}
                      drawn={drawn}
                      toGo={card.toGo}
                      mine={card.mine}
                      won={card.won}
                      onClick={() => setFocused(card)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {truncated > 0 ? (
          <p className="mt-3 text-center font-mono text-[9.5px] uppercase tracking-label text-pump-100/30">
            + {truncated} more cards in play, not shown
          </p>
        ) : null}
      </div>

      {/* Click a card on the floor to see it properly. */}
      <AnimatePresence>
        {focused ? (
          <motion.div
            className="fixed inset-0 z-[65] flex items-center justify-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFocused(null)}
          >
            <div className="absolute inset-0 bg-forest-950/85 backdrop-blur-sm" />
            <motion.div
              className="relative w-full max-w-sm"
              initial={{ scale: 0.35, opacity: 0, y: 60 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 230, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
            >
              <BingoCard
                card={generateCard(focused.wallet, focused.cardIndex)}
                drawn={drawn}
                lastBall={lastBall}
                size="lg"
                label={`${focused.mine ? 'Your card' : shortWallet(focused.wallet, 6, 6)} · ${
                  focused.toGo === 0 ? 'HOUSE' : `${focused.toGo} to go`
                }`}
                footer={`Card #${String(focused.cardIndex + 1).padStart(3, '0')}`}
              />
              <button
                type="button"
                onClick={() => setFocused(null)}
                className="btn-dark mt-3 w-full"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
