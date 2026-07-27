'use client';

import { useEffect } from 'react';

/**
 * Catches any runtime error rather than handing the visitor Next's default
 * error screen.
 *
 * Deliberately shows nothing technical — no message, no digest, no variable
 * names. Visitors get a calm retry; the detail goes to the console for
 * whoever is debugging.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[bingo] unhandled error:', error);
  }, [error]);

  return (
    <div className="hall-glow flex min-h-screen items-center justify-center bg-forest-900 p-6">
      <div className="w-full max-w-md rounded-2xl border-2 border-forest-900 bg-white p-7 text-center shadow-card">
        <p className="eyebrow mb-2">One moment</p>
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight">
          The hall is catching its breath
        </h1>

        <p className="mb-5 text-[13.5px] leading-relaxed text-forest-900/65">
          Give it a second and try again — the next game is never far away.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="btn-primary">
            Try again
          </button>
          <a href="/" className="btn-ghost">
            Back to the front
          </a>
        </div>
      </div>
    </div>
  );
}
