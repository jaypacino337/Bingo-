'use client';

import { sol } from '@/lib/format';
import { useDrop } from '@/lib/useGame';

function ago(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/** The last few drops, newest first. */
export function DropFeed() {
  const { state } = useDrop();
  const drops = state?.recentDrops ?? [];

  if (drops.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-ink bg-white px-6 py-10 text-center shadow-lift">
        <p className="font-mono text-[11px] uppercase tracking-label text-ink/45">
          No drops yet
        </p>
        <p className="mt-2 text-[14px] text-ink/60">
          The first one lands as soon as there are fees in the pot.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-ink bg-white shadow-lift">
      <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b-2 border-ink bg-ink px-5 py-3">
        {['When', 'Holders paid', 'Sent'].map((h) => (
          <span key={h} className="font-mono text-[10px] uppercase tracking-label text-cash-300">
            {h}
          </span>
        ))}
      </div>

      <ul className="divide-y divide-ink/10">
        {drops.slice(0, 10).map((drop, i) => (
          <li
            key={`${drop.at}-${i}`}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3.5"
          >
            <span className="flex items-center gap-2 font-mono text-[12px] text-ink/70">
              {ago(drop.at)}
              {drop.dryRun ? (
                <span className="rounded-full border border-ink/20 px-2 py-0.5 text-[9px] uppercase tracking-label text-ink/40">
                  dry run
                </span>
              ) : null}
            </span>
            <span className="text-right font-mono text-[12px] tabular-nums text-ink/70">
              {drop.paid}
              {drop.failed > 0 ? <span className="text-ink/35"> · {drop.failed} failed</span> : null}
            </span>
            <span className="text-right text-[14px] font-extrabold tabular-nums text-cash-600">
              {sol(drop.sentLamports, 4)} SOL
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
