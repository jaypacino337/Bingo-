import { Connection, PublicKey } from '@solana/web3.js';
import { config, LAMPORTS_PER_SOL } from './config.js';

export const connection = new Connection(config.rpcUrl, 'confirmed');

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export interface HolderBalance {
  wallet: string;
  /** Whole-token (UI) amount, decimals applied. */
  amount: number;
  fetchedAt: number;
}

const cache = new Map<string, HolderBalance>();

export function isValidWallet(address: string): boolean {
  try {
    // Rejects wrong length / bad base58 and, unlike a regex, catches
    // off-curve garbage that looks superficially valid.
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}


/**
 * Total balance of TOKEN_MINT held by `wallet`, summed across every token
 * account it owns (wallets routinely have more than one).
 */
export async function getHolderBalance(wallet: string, force = false): Promise<HolderBalance> {
  const now = Date.now();
  const cached = cache.get(wallet);
  if (!force && cached && now - cached.fetchedAt < config.holderCacheSeconds * 1000) {
    return cached;
  }

  if (config.devFakeHolders) {
    // Deterministic pretend balance, derived from the address itself.
    let hash = 0;
    for (let i = 0; i < wallet.length; i++) hash = (hash * 31 + wallet.charCodeAt(i)) >>> 0;
    const fake: HolderBalance = {
      wallet,
      amount: 250_000 + (hash % 40_000_000),
      fetchedAt: now,
    };
    cache.set(wallet, fake);
    return fake;
  }

  const owner = new PublicKey(wallet);
  const mint = new PublicKey(config.tokenMint);

  let amount = 0;
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    let res;
    try {
      res = await connection.getParsedTokenAccountsByOwner(owner, { mint, programId });
    } catch {
      // Token-2022 lookups fail on RPCs that don't index it; a classic SPL
      // token simply has no 2022 accounts. Either way, skip and keep going.
      continue;
    }
    for (const { account } of res.value) {
      const parsed = account.data.parsed as
        | { info?: { tokenAmount?: { uiAmount?: number | null } } }
        | undefined;
      amount += parsed?.info?.tokenAmount?.uiAmount ?? 0;
    }
  }

  const balance: HolderBalance = { wallet, amount, fetchedAt: now };
  cache.set(wallet, balance);
  return balance;
}

export function invalidateHolder(wallet: string): void {
  cache.delete(wallet);
}

/** SOL balance of the creator-fee treasury, in lamports. */
export async function getTreasuryLamports(): Promise<number> {
  if (config.devFakeHolders) {
    // Drifts upward like fees actually accruing, so the countdown and pot on
    // screen behave the way they will in production.
    return Math.floor(0.4 * LAMPORTS_PER_SOL + (Date.now() / 1000) % 600 * 2_000_000);
  }
  if (!config.treasuryWallet) return 0;
  try {
    return await connection.getBalance(new PublicKey(config.treasuryWallet), 'confirmed');
  } catch (err) {
    console.error('[solana] treasury balance lookup failed:', err);
    return 0;
  }
}

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}
