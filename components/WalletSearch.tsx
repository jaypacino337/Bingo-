'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BingoCard } from './BingoCard';
import { fetchHolder, type HolderInfo } from '@/lib/api';
import { generateCard } from '@/lib/bingo';
import { compactTokens, fullTokens, shortWallet } from '@/lib/format';
import { buyUrl, site } from '@/lib/site';
import { useStoredWallet } from '@/lib/useGame';

type Status = 'idle' | 'loading' | 'found' | 'error';

/**
 * Paste a wallet, we look up its $BINGO, and the card it earned zooms up out
 * of the page. Click the card to take your seat in the hall.
 */
export function WalletSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [, storeWallet] = useStoredWallet();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [holder, setHolder] = useState<HolderInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cardIndex, setCardIndex] = useState(0);

  const search = useCallback(
    async (raw: string) => {
      const wallet = raw.trim();
      if (!wallet) return;

      setStatus('loading');
      setError(null);
      setCardIndex(0);
      try {
        const info = await fetchHolder(wallet);
        setHolder(info);
        setStatus('found');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lookup failed.');
        setStatus('error');
      }
    },
    [],
  );

  const close = useCallback(() => {
    setStatus('idle');
    setHolder(null);
  }, []);

  const enter = useCallback(() => {
    if (!holder?.eligible) return;
    storeWallet(holder.wallet);
    router.push(`/play?w=${encodeURIComponent(holder.wallet)}`);
  }, [holder, router, storeWallet]);

  // Esc closes the zoomed card.
  useEffect(() => {
    if (status !== 'found' && status !== 'error') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, close]);

  const open = status === 'found' || status === 'error';

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(value);
        }}
        className={`flex w-full flex-col gap-2 sm:flex-row ${compact ? '' : 'max-w-xl'}`}
      >
        <div className="relative flex-1">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste your Solana wallet…"
            aria-label="Your Solana wallet address"
            className="w-full rounded-xl border-2 border-forest-900 bg-white px-4 py-3 font-mono text-[13px]
                       text-forest-900 shadow-lift outline-none placeholder:text-forest-900/35
                       focus:ring-4 focus:ring-pump-300/50"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'loading' || value.trim().length === 0}
          className="btn-primary shrink-0"
        >
          {status === 'loading' ? 'Checking…' : 'Find my cards'}
        </button>
      </form>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <div className="absolute inset-0 bg-forest-950/80 backdrop-blur-sm" />

            <motion.div
              className="relative my-auto w-full max-w-md"
              // The zoom: the card rushes up out of the page.
              initial={{ scale: 0.28, opacity: 0, y: 90, rotateX: 22 }}
              animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.4, opacity: 0, y: 60 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.9 }}
              style={{ perspective: 1000 }}
              onClick={(e) => e.stopPropagation()}
            >
              {status === 'error' || !holder ? (
                <ErrorPanel message={error ?? 'Something went wrong.'} onClose={close} />
              ) : holder.eligible ? (
                <div className="text-center">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-label text-pump-400">
                    {shortWallet(holder.wallet, 6, 6)}
                  </p>
                  <h3 className="mb-1 text-2xl font-extrabold tracking-tight text-white">
                    You&rsquo;re holding {compactTokens(holder.amount)} ${site.symbol}
                  </h3>
                  <p className="mb-4 text-sm text-pump-200/80">
                    That&rsquo;s{' '}
                    <span className="font-bold text-pump-300">
                      {holder.cards} card{holder.cards === 1 ? '' : 's'}
                    </span>{' '}
                    in every game.
                  </p>

                  <button
                    type="button"
                    onClick={enter}
                    className="group block w-full text-left"
                    aria-label="Take your seat in the hall"
                  >
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <BingoCard
                        card={generateCard(holder.wallet, cardIndex)}
                        size="lg"
                        label={`Card #${String(cardIndex + 1).padStart(3, '0')} · ${shortWallet(holder.wallet)}`}
                        footer="Click to take your seat"
                        className="ring-4 ring-pump-400/0 transition group-hover:ring-pump-400/60"
                      />
                    </motion.div>
                  </button>

                  {holder.cards > 1 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                      {Array.from({ length: Math.min(holder.cards, 12) }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCardIndex(i)}
                          aria-label={`Preview card ${i + 1}`}
                          className={`h-2 w-2 rounded-full transition ${
                            i === cardIndex ? 'w-5 bg-pump-400' : 'bg-pump-400/35 hover:bg-pump-400/70'
                          }`}
                        />
                      ))}
                      {holder.cards > 12 ? (
                        <span className="ml-1 font-mono text-[10px] text-pump-400/70">
                          +{holder.cards - 12}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <button type="button" onClick={enter} className="btn-primary">
                      Take your seat →
                    </button>
                    <button type="button" onClick={close} className="btn-dark">
                      Not now
                    </button>
                  </div>
                </div>
              ) : (
                <NotEnoughPanel holder={holder} onClose={close} />
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ErrorPanel({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-forest-900 bg-white p-6 text-center shadow-card">
      <p className="eyebrow mb-2">No luck</p>
      <h3 className="mb-2 text-xl font-extrabold tracking-tight">Couldn&rsquo;t read that wallet</h3>
      <p className="mb-5 text-sm text-forest-900/70">{message}</p>
      <button type="button" onClick={onClose} className="btn-ghost">
        Try again
      </button>
    </div>
  );
}

function NotEnoughPanel({ holder, onClose }: { holder: HolderInfo; onClose: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-forest-900 bg-white p-6 text-center shadow-card">
      <p className="eyebrow mb-2">Not in this one</p>
      <h3 className="mb-2 text-xl font-extrabold tracking-tight">You need a book of cards</h3>
      <p className="mb-1 text-sm text-forest-900/70">
        This wallet holds{' '}
        <span className="font-bold text-forest-900">
          {fullTokens(holder.amount)} ${site.symbol}
        </span>
        .
      </p>
      <p className="mb-5 text-sm text-forest-900/70">
        You need {fullTokens(holder.minTokensToPlay)} for your first card —{' '}
        <span className="font-bold text-pump-600">
          {fullTokens(holder.toNextCard)} more
        </span>
        .
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary">
          Buy ${site.symbol}
        </a>
        <button type="button" onClick={onClose} className="btn-ghost">
          Close
        </button>
      </div>
    </div>
  );
}
