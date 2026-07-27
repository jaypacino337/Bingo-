'use client';

import { useEffect } from 'react';

/**
 * Catches any runtime error rather than handing the visitor Next's default
 * error screen. Shows the real message, because a deploy that half-works is
 * far easier to fix when the page says what broke.
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
        <p className="eyebrow mb-2">Something went wrong</p>
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight">The hall dropped out</h1>

        <p className="mb-4 break-words rounded-lg bg-mint-100 px-3 py-2 text-left font-mono text-[11px] leading-relaxed text-forest-700">
          {error.message || 'Unknown error'}
          {error.digest ? (
            <>
              <br />
              <span className="opacity-60">digest: {error.digest}</span>
            </>
          ) : null}
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
