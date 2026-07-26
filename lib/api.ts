/**
 * Talks to the Railway game server.
 *
 * Set NEXT_PUBLIC_GAME_URL in Vercel to your Railway URL, e.g.
 *   https://bingo-server-production.up.railway.app
 */

export const GAME_URL = (process.env.NEXT_PUBLIC_GAME_URL ?? 'http://localhost:8080').replace(
  /\/$/,
  '',
);

/** ws:// or wss:// depending on how the game server is served. */
export function wsUrl(): string {
  return `${GAME_URL.replace(/^http/, 'ws')}/ws`;
}

export interface HolderInfo {
  wallet: string;
  amount: number;
  cards: number;
  eligible: boolean;
  toNextCard: number;
  tokensPerCard: number;
  minTokensToPlay: number;
}

export interface GameConfig {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokensPerCard: number;
  minTokensToPlay: number;
  maxCardsPerWallet: number;
  winPattern: 'line' | 'x' | 'full';
  ballIntervalMs: number;
  lobbyMs: number;
  jackpotOdds: number;
  prizeShare: number;
  jackpotShare: number;
  potSource: string;
  treasuryWallet: string | null;
}

export interface Winner {
  wallet: string;
  cardIndex: number;
  ballNumber: number | null;
  ballsCalled: number;
  prizeLamports: number;
  jackpotWon: boolean;
  jackpotRoll: number;
  jackpotLamports: number;
  line: [number, number][];
}

export interface RecentWinner {
  wallet: string;
  roundId: number;
  prizeLamports: number;
  jackpotLamports: number;
  jackpotWon: boolean;
  createdAt: string;
}

export type Phase = 'lobby' | 'preroll' | 'drawing' | 'celebration';

export interface GameState {
  roundId: number | null;
  phase: Phase;
  pattern: 'line' | 'x' | 'full';
  phaseEndsAt: number;
  draws: number[];
  lastBall: number | null;
  lastLetter: string | null;
  ballsCalled: number;
  potLamports: number;
  prizeLamports: number;
  jackpotLamports: number;
  jackpotOdds: number;
  players: { wallet: string; cards: number }[];
  playersCount: number;
  cardsCount: number;
  hotCards: { wallet: string; cardIndex: number; remaining: number }[];
  winners: Winner[];
  serverSeedHash: string;
  serverSeed: string | null;
  recentWinners: RecentWinner[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GAME_URL}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export function fetchHolder(wallet: string): Promise<HolderInfo> {
  return request<HolderInfo>(`/api/holder/${encodeURIComponent(wallet)}`);
}

export function fetchConfig(): Promise<GameConfig> {
  return request<GameConfig>('/api/config');
}

export function fetchState(): Promise<GameState> {
  return request<GameState>('/api/state');
}

export function joinGame(wallet: string): Promise<{ ok: true; cards: number; tokenAmount: number }> {
  return request('/api/join', { method: 'POST', body: JSON.stringify({ wallet }) });
}
