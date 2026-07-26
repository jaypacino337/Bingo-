import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from './config.js';
import { connection } from './solana.js';
import { markPayout } from './db.js';

/**
 * Payouts are OFF by default. With AUTO_PAYOUT=false every win is written to
 * Supabase with payout_status='pending' and you settle from the treasury by
 * hand (or with your own script) — no hot key on the server.
 *
 * Turn it on only once you understand that the server then holds a key that
 * can move funds. Keep the treasury topped up with just what rounds need.
 */

let treasury: Keypair | null = null;

if (config.autoPayout) {
  if (!config.payoutSecretKey) {
    throw new Error('AUTO_PAYOUT=true requires PAYOUT_SECRET_KEY (base58 secret key)');
  }
  try {
    treasury = Keypair.fromSecretKey(bs58.decode(config.payoutSecretKey.trim()));
  } catch (err) {
    throw new Error(`PAYOUT_SECRET_KEY is not a valid base58 secret key: ${String(err)}`);
  }
  if (config.treasuryWallet && treasury.publicKey.toBase58() !== config.treasuryWallet) {
    console.warn(
      `[payout] PAYOUT_SECRET_KEY resolves to ${treasury.publicKey.toBase58()} but ` +
        `TREASURY_WALLET is ${config.treasuryWallet}. Pot sizing and payouts will use different wallets.`,
    );
  }
  console.log(`[payout] auto-payout ENABLED from ${treasury.publicKey.toBase58()}`);
} else {
  console.log('[payout] auto-payout disabled — wins recorded as pending for manual settlement');
}

export const payoutEnabled = () => treasury !== null;

export interface PayoutResult {
  status: 'sent' | 'failed' | 'manual';
  signature?: string;
  error?: string;
}

export async function payWinner(
  winnerId: number | null,
  wallet: string,
  lamports: number,
): Promise<PayoutResult> {
  if (lamports <= 0) return { status: 'manual' };

  if (!treasury) {
    await markPayout(winnerId, 'manual');
    return { status: 'manual' };
  }

  try {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: new PublicKey(wallet),
        lamports,
      }),
    );
    const signature = await sendAndConfirmTransaction(connection, tx, [treasury], {
      commitment: 'confirmed',
    });
    await markPayout(winnerId, 'sent', signature);
    console.log(`[payout] sent ${lamports} lamports to ${wallet} — ${signature}`);
    return { status: 'sent', signature };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[payout] FAILED ${lamports} lamports to ${wallet}:`, error);
    await markPayout(winnerId, 'failed');
    return { status: 'failed', error };
  }
}
