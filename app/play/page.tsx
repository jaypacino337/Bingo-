import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GameRoom } from '@/components/GameRoom';

export const metadata: Metadata = {
  title: 'The hall',
  description: 'Live on-chain bingo. Eyes down.',
};

// The room is entirely live — nothing here should be cached.
export const dynamic = 'force-dynamic';

export default function PlayPage() {
  return (
    <Suspense fallback={<Loading />}>
      <GameRoom />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="hall-glow flex min-h-screen items-center justify-center bg-forest-900">
      <p className="font-mono text-[11px] uppercase tracking-label text-pump-400/60">
        Opening the hall…
      </p>
    </div>
  );
}
