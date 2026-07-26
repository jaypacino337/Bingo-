import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * Supabase is optional. Without it the game still runs end to end — it just
 * keeps history in memory and loses it on restart. Every helper below degrades
 * to a no-op / in-memory fallback so the engine never has to branch on it.
 */
export const db: SupabaseClient | null =
  config.supabaseUrl && config.supabaseServiceKey
    ? createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export const dbEnabled = db !== null;

if (!dbEnabled) {
  console.warn('[db] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — running in memory-only mode');
}

let memoryJackpot = 0;

export interface WinnerRecord {
  roundId: number;
  wallet: string;
  cardIndex: number;
  ballNumber: number | null;
  ballsCalled: number;
  prizeLamports: number;
  jackpotWon: boolean;
  jackpotRoll: number;
  jackpotLamports: number;
}

export interface RecentWinner {
  wallet: string;
  roundId: number;
  prizeLamports: number;
  jackpotLamports: number;
  jackpotWon: boolean;
  createdAt: string;
}

const memoryWinners: RecentWinner[] = [];

function logError(scope: string, error: unknown): void {
  if (error) console.error(`[db] ${scope}:`, error);
}

export async function createRound(input: {
  serverSeedHash: string;
  pattern: string;
  potLamports: number;
  prizeLamports: number;
  jackpotAddLamports: number;
}): Promise<number | null> {
  if (!db) return null;
  const { data, error } = await db
    .from('rounds')
    .insert({
      status: 'lobby',
      pattern: input.pattern,
      server_seed_hash: input.serverSeedHash,
      pot_lamports: input.potLamports,
      prize_lamports: input.prizeLamports,
      jackpot_add_lamports: input.jackpotAddLamports,
    })
    .select('id')
    .single();
  logError('createRound', error);
  return data?.id ?? null;
}

export async function updateRound(
  roundId: number | null,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!db || roundId === null) return;
  const { error } = await db.from('rounds').update(patch).eq('id', roundId);
  logError('updateRound', error);
}

export async function recordEntry(input: {
  roundId: number | null;
  wallet: string;
  cards: number;
  tokenAmount: number;
}): Promise<void> {
  if (!db || input.roundId === null) return;
  const { error } = await db.from('entries').upsert(
    {
      round_id: input.roundId,
      wallet: input.wallet,
      cards: input.cards,
      token_amount: input.tokenAmount,
    },
    { onConflict: 'round_id,wallet' },
  );
  logError('recordEntry', error);
}

export async function recordWinner(w: WinnerRecord): Promise<number | null> {
  memoryWinners.unshift({
    wallet: w.wallet,
    roundId: w.roundId,
    prizeLamports: w.prizeLamports,
    jackpotLamports: w.jackpotLamports,
    jackpotWon: w.jackpotWon,
    createdAt: new Date().toISOString(),
  });
  memoryWinners.splice(50);

  if (!db) return null;
  const { data, error } = await db
    .from('winners')
    .insert({
      round_id: w.roundId,
      wallet: w.wallet,
      card_index: w.cardIndex,
      ball_number: w.ballNumber,
      balls_called: w.ballsCalled,
      prize_lamports: w.prizeLamports,
      jackpot_won: w.jackpotWon,
      jackpot_roll: w.jackpotRoll,
      jackpot_lamports: w.jackpotLamports,
      payout_status: 'pending',
    })
    .select('id')
    .single();
  logError('recordWinner', error);
  return data?.id ?? null;
}

export async function markPayout(
  winnerId: number | null,
  status: 'sent' | 'failed' | 'manual',
  signature?: string,
): Promise<void> {
  if (!db || winnerId === null) return;
  const { error } = await db
    .from('winners')
    .update({ payout_status: status, payout_signature: signature ?? null })
    .eq('id', winnerId);
  logError('markPayout', error);
}

export async function getJackpot(): Promise<number> {
  if (!db) return memoryJackpot;
  const { data, error } = await db.from('jackpot').select('lamports').eq('id', 1).single();
  logError('getJackpot', error);
  return Number(data?.lamports ?? 0);
}

export async function addToJackpot(lamports: number): Promise<number> {
  if (lamports <= 0) return getJackpot();
  if (!db) {
    memoryJackpot += lamports;
    return memoryJackpot;
  }
  const { data, error } = await db.rpc('jackpot_add', { amount: lamports });
  if (error) {
    logError('addToJackpot', error);
    return getJackpot();
  }
  return Number(data ?? 0);
}

/** Zeroes the jackpot and returns what was in it. */
export async function drainJackpot(roundId: number | null): Promise<number> {
  if (!db) {
    const paid = memoryJackpot;
    memoryJackpot = 0;
    return paid;
  }
  const { data, error } = await db.rpc('jackpot_drain', { round: roundId });
  if (error) {
    logError('drainJackpot', error);
    return 0;
  }
  return Number(data ?? 0);
}

export async function recentWinners(limit = 12): Promise<RecentWinner[]> {
  if (!db) return memoryWinners.slice(0, limit);
  const { data, error } = await db
    .from('winners')
    .select('wallet, round_id, prize_lamports, jackpot_lamports, jackpot_won, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  logError('recentWinners', error);
  if (!data) return memoryWinners.slice(0, limit);
  return data.map((r) => ({
    wallet: r.wallet as string,
    roundId: Number(r.round_id),
    prizeLamports: Number(r.prize_lamports),
    jackpotLamports: Number(r.jackpot_lamports),
    jackpotWon: Boolean(r.jackpot_won),
    createdAt: r.created_at as string,
  }));
}

export async function leaderboard(limit = 20) {
  if (!db) return [];
  const { data, error } = await db
    .from('leaderboard')
    .select('wallet, wins, total_lamports, last_win_at')
    .limit(limit);
  logError('leaderboard', error);
  return (data ?? []).map((r) => ({
    wallet: r.wallet as string,
    wins: Number(r.wins),
    totalLamports: Number(r.total_lamports),
    lastWinAt: r.last_win_at as string,
  }));
}
