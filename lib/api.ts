/**
 * Talks to the Railway airdrop server.
 *
 * Set NEXT_PUBLIC_GAME_URL in Vercel to your Railway URL, e.g.
 *   https://cashcow-production.up.railway.app
 */

const RAW_GAME_URL = process.env.NEXT_PUBLIC_GAME_URL ?? '';

export const GAME_URL = (RAW_GAME_URL || 'http://localhost:8080').replace(/\/$/, '');

/**
 * Whether the game server has actually been pointed at.
 *
 * Without this the app would silently fall back to localhost, and on an HTTPS
 * deployment the browser blocks that as mixed content — every request fails
 * with a security error that looks like a bug rather than missing config. We
 * check up front so the hall can say what's actually wrong.
 */
export const GAME_CONFIGURED = RAW_GAME_URL.length > 0;

/** Set when the config is present but cannot work from a browser. */
export function gameUrlProblem(): string | null {
  if (!GAME_CONFIGURED) {
    return 'NEXT_PUBLIC_GAME_URL is not set, so there is no game server to connect to.';
  }
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    GAME_URL.startsWith('http://')
  ) {
    return 'NEXT_PUBLIC_GAME_URL uses http:// but this site is served over https://. Browsers block that. Use the https:// Railway URL.';
  }
  return null;
}

/** ws:// or wss:// depending on how the game server is served. */
export function wsUrl(): string {
  return `${GAME_URL.replace(/^http/, 'ws')}/ws`;
}

export interface HolderInfo {
  wallet: string;
  amount: number;
  eligible: boolean;
  minTokens: number;
  nextDropLamports: number;
  sharePercent: number;
  totalEarnedLamports: number;
}

export interface DropConfig {
  tokenMint: string;
  tokenSymbol: string;
  tokenName: string;
  tokenSupply: number;
  airdropIntervalMs: number;
  airdropMinTokens: number;
  treasuryWallet: string | null;
  demoMode: boolean;
}


export interface DropSummary {
  id: number | null;
  at: number;
  holders: number;
  paid: number;
  failed: number;
  poolLamports: number;
  sentLamports: number;
  signatures: string[];
  dryRun: boolean;
}

export type DropPhase = 'waiting' | 'snapshotting' | 'sending' | 'done';

export interface DropState {
  phase: DropPhase;
  nextRunAt: number;
  intervalMs: number;
  treasuryLamports: number;
  pendingPoolLamports: number;
  holderCount: number;
  totalPaidLamports: number;
  dropCount: number;
  lastDrop: DropSummary | null;
  recentDrops: DropSummary[];
  live: boolean;
  progress: { sent: number; total: number } | null;
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

export function fetchConfig(): Promise<DropConfig> {
  return request<DropConfig>('/api/config');
}

export function fetchState(): Promise<DropState> {
  return request<DropState>('/api/state');
}
