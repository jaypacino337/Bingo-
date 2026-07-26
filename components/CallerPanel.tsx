'use client';

import { useEffect, useState } from 'react';
import { callFor } from '@/lib/calls';
import { letterFor } from '@/lib/bingo';
import { site } from '@/lib/site';

/** Shown until public/host.png is dropped in — see README. */
function CallerPlaceholder() {
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="100" height="100" fill="#0E3220" />
      <circle cx="50" cy="38" r="17" fill="#5BE49B" />
      <path d="M18 100c0-18 14-30 32-30s32 12 32 30Z" fill="#5BE49B" />
      <circle cx="50" cy="38" r="17" fill="none" stroke="#04140C" strokeWidth="2.5" />
    </svg>
  );
}

/**
 * The caller: the ball that just dropped, its old-hall nickname, and the face
 * calling it. Mirrors the panel down the left of the hall screenshot.
 */
export function CallerPanel({ ball }: { ball: number | null }) {
  const [avatarOk, setAvatarOk] = useState(true);

  // Re-trigger the pop animation on each new ball.
  const [key, setKey] = useState(0);
  useEffect(() => {
    setKey((k) => k + 1);
  }, [ball]);

  return (
    <div className="flex flex-col items-center gap-4 lg:items-start">
      {/* The call */}
      <div className="w-full max-w-[230px] rounded-2xl border-2 border-forest-900 bg-white px-5 py-4 text-center shadow-card">
        <p className="mb-1 truncate text-[12px] italic text-forest-900/55">
          {ball === null ? 'Eyes down…' : `${callFor(ball)}…`}
        </p>
        <p
          key={key}
          className="animate-ball-in text-[34px] font-extrabold leading-none tracking-tight text-pump-500 tabular-nums"
        >
          {ball === null ? '—' : `${letterFor(ball)}·${ball}`}
        </p>
      </div>

      {/* The caller */}
      <div className="relative">
        <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-pump-400/50" />
        <div className="relative h-[132px] w-[132px] overflow-hidden rounded-full border-[3px] border-pump-400 bg-forest-700">
          {/* Placeholder sits underneath, so a missing avatar still looks
              deliberate rather than like a broken image. */}
          <CallerPlaceholder />
          {avatarOk ? (
            // Plain <img>: the avatar is a static asset the operator drops in,
            // and next/image would want build-time knowledge of it.
            // Empty alt — the placeholder below already carries the meaning.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/host.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={() => setAvatarOk(false)}
            />
          ) : null}
        </div>
      </div>

      <div className="text-center lg:text-left">
        <span className="inline-block rounded-lg border-2 border-forest-900 bg-pump-300 px-3 py-1.5 text-[12px] font-bold text-forest-900">
          {site.callerName} · Your caller tonight
        </span>
        <p className="mt-2 font-mono text-[9.5px] uppercase tracking-label text-pump-400/60">
          {site.callerTitle}
        </p>
      </div>
    </div>
  );
}
