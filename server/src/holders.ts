import { createHash } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import { config } from './config.js';
import { connection } from './solana.js';

/**
 * Snapshotting every holder of the mint.
 *
 * There is no "list all holders" RPC call. The only way is to scan every token
 * account for the mint via getProgramAccounts and fold them by owner, since one
 * wallet can hold the token across several accounts.
 *
 * This is an expensive call and most public RPCs refuse it outright — it needs
 * a paid endpoint (Helius, QuickNode, Triton). The result is cached for a short
 * window so a snapshot cycle doesn't hammer the provider.
 */

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

/** SPL token account layout: mint(32) owner(32) amount(8) … */
const ACCOUNT_SIZE = 165;
const MINT_OFFSET = 0;
const OWNER_OFFSET = 32;
const AMOUNT_OFFSET = 64;

export interface Holder {
  wallet: string;
  /** Whole-token (UI) amount, decimals applied. */
  amount: number;
  /** Raw base units, kept for exact proportional maths. */
  raw: bigint;
}

export interface Snapshot {
  holders: Holder[];
  totalRaw: bigint;
  takenAt: number;
  /** Holders dropped for being below the minimum, or excluded by config. */
  skipped: number;
}

let decimalsCache: number | null = null;

async function getDecimals(): Promise<number> {
  if (decimalsCache !== null) return decimalsCache;
  const info = await connection.getParsedAccountInfo(new PublicKey(config.tokenMint));
  const data = info.value?.data as { parsed?: { info?: { decimals?: number } } } | undefined;
  decimalsCache = data?.parsed?.info?.decimals ?? 6;
  return decimalsCache;
}

/**
 * Wallets that hold the token but are not real holders — the bonding curve,
 * liquidity pools, the treasury itself. Paying these out would burn the pool
 * on accounts that are not people.
 */
function excluded(): Set<string> {
  const set = new Set(config.excludeWallets);
  if (config.treasuryWallet) set.add(config.treasuryWallet);
  return set;
}

/** DEV ONLY — a believable holder list so the site can run without an RPC. */
function fakeSnapshot(): Snapshot {
  const holders: Holder[] = [];
  let totalRaw = 0n;
  for (let i = 0; i < 120; i++) {
    // A few whales, a long tail — roughly how a real holder list looks.
    const weight = Math.floor(1e12 / (i + 1) ** 1.4) + 1_000_000;
    const raw = BigInt(weight);
    const digest = createHash('sha256').update(`cashcow-demo-holder:${i}`).digest();
    holders.push({
      wallet: new PublicKey(new Uint8Array(digest)).toBase58(),
      amount: Number(raw) / 1e6,
      raw,
    });
    totalRaw += raw;
  }
  return { holders, totalRaw, takenAt: Date.now(), skipped: 3 };
}

export async function snapshotHolders(): Promise<Snapshot> {
  if (config.devFakeHolders) return fakeSnapshot();

  const mint = new PublicKey(config.tokenMint);
  const decimals = await getDecimals();
  const skip = excluded();
  const byOwner = new Map<string, bigint>();

  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    let accounts;
    try {
      accounts = await connection.getProgramAccounts(programId, {
        // Only pull the bytes we need — the full account is dead weight at scale.
        dataSlice: { offset: OWNER_OFFSET, length: 40 },
        filters: [
          { dataSize: ACCOUNT_SIZE },
          { memcmp: { offset: MINT_OFFSET, bytes: mint.toBase58() } },
        ],
      });
    } catch (err) {
      // Token-2022 is often unindexed, and a classic SPL mint has no 2022
      // accounts anyway. A failure on the main program is worth shouting about.
      if (programId.equals(TOKEN_PROGRAM_ID)) {
        throw new Error(
          `Could not scan token accounts. This RPC probably does not allow ` +
            `getProgramAccounts — use Helius, QuickNode or Triton. (${String(err)})`,
        );
      }
      continue;
    }

    for (const { account } of accounts) {
      const data = account.data;
      if (data.length < 40) continue;
      const owner = new PublicKey(data.subarray(0, 32)).toBase58();
      const amount = data.readBigUInt64LE(AMOUNT_OFFSET - OWNER_OFFSET);
      if (amount === 0n) continue;
      byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amount);
    }
  }

  const divisor = 10 ** decimals;
  const minRaw = BigInt(Math.floor(config.airdropMinTokens * divisor));

  const holders: Holder[] = [];
  let totalRaw = 0n;
  let skipped = 0;

  for (const [wallet, raw] of byOwner) {
    if (skip.has(wallet) || raw < minRaw) {
      skipped++;
      continue;
    }
    holders.push({ wallet, amount: Number(raw) / divisor, raw });
    totalRaw += raw;
  }

  holders.sort((a, b) => (b.raw > a.raw ? 1 : b.raw < a.raw ? -1 : 0));
  return { holders, totalRaw, takenAt: Date.now(), skipped };
}

export interface Allocation {
  wallet: string;
  lamports: number;
  amount: number;
}

/**
 * Split a pool proportionally by holding. Uses bigint throughout so a large
 * supply cannot lose precision, and drops allocations below the dust floor —
 * a transfer that costs more in fees than it delivers helps nobody.
 */
export function allocate(snapshot: Snapshot, poolLamports: number): {
  allocations: Allocation[];
  dust: number;
} {
  if (snapshot.totalRaw === 0n || poolLamports <= 0) {
    return { allocations: [], dust: poolLamports };
  }

  const pool = BigInt(Math.floor(poolLamports));
  const allocations: Allocation[] = [];
  let handed = 0n;

  for (const holder of snapshot.holders) {
    const share = (pool * holder.raw) / snapshot.totalRaw;
    if (share < BigInt(config.airdropMinLamports)) continue;
    allocations.push({
      wallet: holder.wallet,
      lamports: Number(share),
      amount: holder.amount,
    });
    handed += share;
  }

  // Rounding remainder plus everything below the floor stays in the treasury
  // and rolls into the next drop.
  return { allocations, dust: Number(pool - handed) };
}
