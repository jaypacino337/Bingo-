import type { Metadata } from 'next';
import { GameRoomClient } from '@/components/GameRoomClient';

export const metadata: Metadata = {
  title: 'The arena',
  description: 'Live on-chain duel royale. Last one standing takes the pot.',
};

/**
 * A static shell. Everything live is loaded client-side by GameRoomClient, so
 * this route has no server-side work that could fail at request time.
 */
export default function PlayPage() {
  return <GameRoomClient />;
}
