'use client';

import dynamic from 'next/dynamic';

/**
 * Loads the hall in the browser only.
 *
 * Nothing in the game room benefits from server rendering — it is a live
 * WebSocket feed driving a WebGL canvas, so the server has no state worth
 * producing HTML from. Rendering it server-side only created a way for the
 * whole route to 500 on something (three.js, a browser API reached too early)
 * that has no bearing on what the user actually sees. Client-only removes that
 * failure mode entirely and keeps `three` out of the server bundle.
 */
const GameRoom = dynamic(() => import('./GameRoom').then((m) => m.GameRoom), {
  ssr: false,
  loading: () => <HallLoading />,
});

function HallLoading() {
  return (
    <div className="hall-glow flex min-h-screen items-center justify-center bg-forest-900">
      <p className="font-mono text-[11px] uppercase tracking-label text-pump-400/60">
        Opening the hall…
      </p>
    </div>
  );
}

export function GameRoomClient() {
  return <GameRoom />;
}
