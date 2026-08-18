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
    console.error('[cashcow] unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cash-50 p-6">
      <div className="w-full max-w-md rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-lift">
        <p className="label mb-2">One moment</p>
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight">
          The cow is having a lie down
        </h1>

        <p className="mb-6 text-[13.5px] leading-relaxed text-ink/65">
          Give it a second and try again — the next drop is never far away.
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
