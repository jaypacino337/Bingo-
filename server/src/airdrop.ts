import { EventEmitter } from 'node:events';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { config } from './config.js';
import { connection, getTreasuryLamports, solToLamports } from './solana.js';
import { allocate, snapshotHolders, type Allocation, type Snapshot } from './holders.js';
import { recordDrop, recordPayouts } from './db.js';

/**
 * The machine: on a timer, take a snapshot of every holder, split the
 * treasury's unreserved balance between them by weight, and send it.
 *
 * "Claiming" pump.fun creator fees is deliberately NOT automated here — see
 * the note on harvest() below. Everything downstream of the fees landing in
 * the treasury is automatic.
 */

export type DropPhase = 'waiting' | 'snapshotting' | 'sending' | 'done';

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

export interface AirdropState {
  phase: DropPhase;
  /** Epoch ms of the next drop. */
  nextRunAt: number;
  intervalMs: number;
  treasuryLamports: number;
  /** What would be shared out if the drop ran right now. */
  pendingPoolLamports: number;
  holderCount: number;
  totalPaidLamports: number;
  dropCount: number;
  lastDrop: DropSummary | null;
  recentDrops: DropSummary[];
  live: boolean;
  progress: { sent: number; total: number } | null;
}

/** Transfers per transaction. Solana caps tx size; ~18 keeps us well inside. */
const TRANSFERS_PER_TX = 18;

export class AirdropEngine extends EventEmitter {
  private phase: DropPhase = 'waiting';
  private nextRunAt = 0;
  private treasuryLamports = 0;
  private pendingPool = 0;
  private holderCount = 0;
  private totalPaid = 0;
  private dropCount = 0;
  private lastDrop: DropSummary | null = null;
  private recent: DropSummary[] = [];
  private progress: { sent: number; total: number } | null = null;
  private snapshot: Snapshot | null = null;

  private treasury: Keypair | null = null;
  private timer: NodeJS.Timeout | null = null;
  private poller: NodeJS.Timeout | null = null;
  private stopped = false;
  private running = false;

  constructor() {
    super();
    if (config.autoPayout) {
      if (!config.payoutSecretKey) {
        throw new Error('AUTO_PAYOUT=true requires PAYOUT_SECRET_KEY');
      }
      try {
        this.treasury = Keypair.fromSecretKey(bs58.decode(config.payoutSecretKey.trim()));
      } catch (err) {
        throw new Error(`PAYOUT_SECRET_KEY is not a valid base58 secret key: ${String(err)}`);
      }
      console.log(`[airdrop] LIVE — paying from ${this.treasury.publicKey.toBase58()}`);
    } else {
      console.log('[airdrop] DRY RUN — drops are computed and recorded but nothing is sent');
    }
  }

  get live(): boolean {
    return this.treasury !== null;
  }

  async start(): Promise<void> {
    this.nextRunAt = Date.now() + config.airdropIntervalMs;
    await this.refresh();
    // Keep the on-screen numbers moving between drops.
    this.poller = setInterval(() => void this.refresh(), 20_000);
    this.poller.unref();
    this.scheduleNext();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.poller) clearInterval(this.poller);
  }

  private scheduleNext(): void {
    if (this.stopped) return;
    const delay = Math.max(1_000, this.nextRunAt - Date.now());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.runDrop(), delay);
  }

  /** Refresh the treasury balance and what's available to share out. */
  private async refresh(): Promise<void> {
    try {
      this.treasuryLamports = await getTreasuryLamports();
      this.pendingPool = this.availablePool();
      this.broadcast();
    } catch (err) {
      console.warn('[airdrop] treasury refresh failed:', err);
    }
  }

  private availablePool(): number {
    const reserve = solToLamports(config.treasuryReserveSol);
    const available = this.treasuryLamports - reserve;
    if (available <= 0) return 0;
    return Math.floor(available * config.airdropPayoutRatio);
  }

  /**
   * Where creator fees come from.
   *
   * pump.fun creator fees are claimed by the coin's creator through pump.fun
   * itself — it is their program and their authority, not something this
   * server holds a key for. So the honest boundary is: you claim fees into
   * TREASURY_WALLET (from the pump.fun UI, or on your own schedule), and this
   * engine shares out whatever it finds there. It never invents a balance.
   */
  private async harvest(): Promise<number> {
    await this.refresh();
    return this.pendingPool;
  }

  async runDrop(force = false): Promise<DropSummary | null> {
    if (this.stopped || this.running) return null;
    this.running = true;

    try {
      const pool = await this.harvest();

      if (pool < config.airdropMinPoolLamports && !force) {
        console.log(
          `[airdrop] skipping — pool ${pool} below floor ${config.airdropMinPoolLamports}`,
        );
        return null;
      }

      this.phase = 'snapshotting';
      this.broadcast();

      const snapshot = await snapshotHolders();
      this.snapshot = snapshot;
      this.holderCount = snapshot.holders.length;

      const { allocations, dust } = allocate(snapshot, pool);
      if (allocations.length === 0) {
        console.log('[airdrop] no eligible holders, nothing to send');
        this.phase = 'waiting';
        return null;
      }

      console.log(
        `[airdrop] dropping ${pool} lamports across ${allocations.length} holders ` +
          `(${dust} dust rolls over)`,
      );

      this.phase = 'sending';
      this.progress = { sent: 0, total: allocations.length };
      this.broadcast();

      const result = await this.send(allocations);

      const summary: DropSummary = {
        id: null,
        at: Date.now(),
        holders: allocations.length,
        paid: result.paid,
        failed: result.failed,
        poolLamports: pool,
        sentLamports: result.sentLamports,
        signatures: result.signatures,
        dryRun: !this.live,
      };

      summary.id = await recordDrop({
        holders: summary.holders,
        paid: summary.paid,
        failed: summary.failed,
        poolLamports: pool,
        sentLamports: result.sentLamports,
        dryRun: summary.dryRun,
      });
      await recordPayouts(summary.id, allocations, result.failures);

      this.totalPaid += result.sentLamports;
      this.dropCount++;
      this.lastDrop = summary;
      this.recent.unshift(summary);
      this.recent.splice(20);
      this.phase = 'done';
      this.progress = null;
      this.broadcast();

      return summary;
    } catch (err) {
      console.error('[airdrop] drop failed:', err);
      this.phase = 'waiting';
      this.progress = null;
      return null;
    } finally {
      this.running = false;
      this.nextRunAt = Date.now() + config.airdropIntervalMs;
      await this.refresh();
      this.phase = 'waiting';
      this.broadcast();
      this.scheduleNext();
    }
  }

  /** Batch the transfers and send them. A dry run just counts. */
  private async send(allocations: Allocation[]): Promise<{
    paid: number;
    failed: number;
    sentLamports: number;
    signatures: string[];
    failures: Set<string>;
  }> {
    const failures = new Set<string>();
    const signatures: string[] = [];
    let paid = 0;
    let sentLamports = 0;

    if (!this.treasury) {
      // Dry run — report exactly what a live run would have moved.
      for (const a of allocations) sentLamports += a.lamports;
      this.progress = { sent: allocations.length, total: allocations.length };
      return { paid: allocations.length, failed: 0, sentLamports, signatures, failures };
    }

    for (let i = 0; i < allocations.length; i += TRANSFERS_PER_TX) {
      const batch = allocations.slice(i, i + TRANSFERS_PER_TX);
      const tx = new Transaction();
      for (const a of batch) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: this.treasury.publicKey,
            toPubkey: new PublicKey(a.wallet),
            lamports: a.lamports,
          }),
        );
      }

      try {
        const signature = await sendAndConfirmTransaction(connection, tx, [this.treasury], {
          commitment: 'confirmed',
        });
        signatures.push(signature);
        paid += batch.length;
        for (const a of batch) sentLamports += a.lamports;
      } catch (err) {
        // One bad batch must not sink the rest of the drop.
        console.error(`[airdrop] batch ${i / TRANSFERS_PER_TX} failed:`, err);
        for (const a of batch) failures.add(a.wallet);
      }

      this.progress = { sent: Math.min(i + batch.length, allocations.length), total: allocations.length };
      this.broadcast();
    }

    return { paid, failed: failures.size, sentLamports, signatures, failures };
  }

  /** What a given wallet would receive if the drop ran right now. */
  shareFor(wallet: string): { amount: number; lamports: number; share: number } | null {
    if (!this.snapshot || this.snapshot.totalRaw === 0n) return null;
    const holder = this.snapshot.holders.find((h) => h.wallet === wallet);
    if (!holder) return null;
    const share = Number(holder.raw) / Number(this.snapshot.totalRaw);
    return {
      amount: holder.amount,
      lamports: Math.floor(this.pendingPool * share),
      share,
    };
  }

  getState(): AirdropState {
    return {
      phase: this.phase,
      nextRunAt: this.nextRunAt,
      intervalMs: config.airdropIntervalMs,
      treasuryLamports: this.treasuryLamports,
      pendingPoolLamports: this.pendingPool,
      holderCount: this.holderCount,
      totalPaidLamports: this.totalPaid,
      dropCount: this.dropCount,
      lastDrop: this.lastDrop,
      recentDrops: this.recent,
      live: this.live,
      progress: this.progress,
    };
  }

  private broadcast(): void {
    this.emit('state', this.getState());
  }
}

export const airdrop = new AirdropEngine();
