import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * Supabase is optional. Without it drops still run — the history just isn't
 * kept. Every helper degrades to a no-op so the engine never branches on it.
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

export interface DropRecord {
  holders: number;
  paid: number;
  failed: number;
  poolLamports: number;
  sentLamports: number;
  dryRun: boolean;
}

function logError(scope: string, error: unknown): void {
  if (error) console.error(`[db] ${scope}:`, error);
}

// ---------------------------------------------------------------------------
// Drops
// ---------------------------------------------------------------------------

export async function recordDrop(drop: DropRecord): Promise<number | null> {
  if (!db) return null;
  const { data, error } = await db
    .from('drops')
    .insert({
      holders: drop.holders,
      paid: drop.paid,
      failed: drop.failed,
      pool_lamports: drop.poolLamports,
      sent_lamports: drop.sentLamports,
      dry_run: drop.dryRun,
    })
    .select('id')
    .single();
  logError('recordDrop', error);
  return data?.id ?? null;
}

export async function recordPayouts(
  dropId: number | null,
  allocations: { wallet: string; lamports: number; amount: number }[],
  failures: Set<string>,
): Promise<void> {
  if (!db || dropId === null || allocations.length === 0) return;
  // Chunked so a large holder set doesn't blow the request limit.
  for (let i = 0; i < allocations.length; i += 500) {
    const rows = allocations.slice(i, i + 500).map((a) => ({
      drop_id: dropId,
      wallet: a.wallet,
      lamports: a.lamports,
      token_amount: a.amount,
      status: failures.has(a.wallet) ? 'failed' : 'sent',
    }));
    const { error } = await db.from('payouts').insert(rows);
    logError('recordPayouts', error);
  }
}

export async function recentDrops(limit = 20) {
  if (!db) return [];
  const { data, error } = await db
    .from('drops')
    .select('id, holders, paid, failed, pool_lamports, sent_lamports, dry_run, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  logError('recentDrops', error);
  return data ?? [];
}

/** Everything a wallet has ever been paid. */
export async function walletHistory(wallet: string, limit = 20) {
  if (!db) return { total: 0, drops: [] as unknown[] };
  const { data, error } = await db
    .from('payouts')
    .select('lamports, token_amount, status, created_at, drop_id')
    .eq('wallet', wallet)
    .order('created_at', { ascending: false })
    .limit(limit);
  logError('walletHistory', error);
  const drops = data ?? [];
  const total = drops
    .filter((d) => d.status === 'sent')
    .reduce((sum, d) => sum + Number(d.lamports), 0);
  return { total, drops };
}
