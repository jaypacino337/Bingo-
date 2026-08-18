'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { fetchHolder, type HolderInfo } from '@/lib/api';
import { compactTokens, fullTokens, shortWallet, sol } from '@/lib/format';
import { buyUrl, site } from '@/lib/site';
import { useStoredWallet } from '@/lib/useGame';

type Status = 'idle' | 'loading' | 'found' | 'error';

/** Paste a wallet, see what the next drop owes it. */
export function WalletCheck() {
  const [stored, store] = useStoredWallet();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [holder, setHolder] = useState<HolderInfo | null>(null);

  const look = useCallback(async (raw: string) => {
    const wallet = raw.trim();
    if (!wallet) return;
    setStatus('loading');
    try {
      const info = await fetchHolder(wallet);
      setHolder(info);
      setStatus('found');
      store(wallet);
    } catch {
      // Nothing technical on the page — just say it didn't work.
      setHolder(null);
      setStatus('error');
    }
  }, [store]);

  // Remember whoever checked last.
  useEffect(() => {
    if (stored && status === 'idle' && value === '') {
      setValue(stored);
      void look(stored);
    }
    // Only on first arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void look(value);
        }}
        className="flex w-full flex-col gap-2.5 sm:flex-row"
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="Paste your Solana wallet…"
          aria-label="Your Solana wallet address"
          className="w-full flex-1 rounded-full border-2 border-ink bg-white px-5 py-3.5 font-mono text-[13px]
                     shadow-lift outline-none placeholder:text-ink/35 focus:ring-4 focus:ring-cash-200"
        />
        <button
          type="submit"
          disabled={status === 'loading' || value.trim().length === 0}
          className="btn-primary shrink-0"
        >
          {status === 'loading' ? 'Checking…' : 'Check my share'}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {status === 'found' && holder ? (
          <motion.div
            key="found"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 overflow-hidden rounded-3xl border-2 border-ink bg-white shadow-card"
          >
            <div className="flex items-center justify-between border-b-2 border-ink bg-cash-400 px-5 py-3">
              <span className="font-mono text-[11px] tracking-label">
                {shortWallet(holder.wallet, 5, 5)}
              </span>
              <span className="font-mono text-[11px] tracking-label">
                {holder.sharePercent.toFixed(3)}% of supply
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x-2 divide-ink/10">
              <div className="px-5 py-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-label text-ink/50">
                  Next drop
                </p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums text-cash-600">
                  {sol(holder.nextDropLamports, 5)}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-label text-ink/40">SOL</p>
              </div>
              <div className="px-5 py-5 text-center">
                <p className="font-mono text-[10px] uppercase tracking-label text-ink/50">
                  Earned so far
                </p>
                <p className="mt-1 text-3xl font-extrabold tabular-nums">
                  {sol(holder.totalEarnedLamports, 5)}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-label text-ink/40">SOL</p>
              </div>
            </div>

            <div className="border-t-2 border-ink/10 bg-smoke px-5 py-3 text-center">
              {holder.eligible ? (
                <p className="text-[13px] text-ink/65">
                  Holding{' '}
                  <span className="font-bold text-ink">
                    {compactTokens(holder.amount)} ${site.symbol}
                  </span>{' '}
                  — you&rsquo;re in every drop automatically.
                </p>
              ) : (
                <p className="text-[13px] text-ink/65">
                  You need at least {fullTokens(holder.minTokens)} ${site.symbol} to be in the
                  snapshot.
                </p>
              )}
            </div>
          </motion.div>
        ) : status === 'error' ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 rounded-3xl border-2 border-ink bg-white px-5 py-6 text-center shadow-card"
          >
            <p className="mb-3 text-[14px] text-ink/70">
              Couldn&rsquo;t read that wallet. Check the address and try again.
            </p>
            <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-ghost">
              Get ${site.symbol}
            </a>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
