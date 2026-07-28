import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PublicKey } from '@solana/web3.js';
import { config, splitPot } from './config.js';
import {
  fighterId,
  resolveRoyale,
  type Duel,
  type Fighter,
  type RoyaleResult,
} from './royale.js';
import {
  addToJackpot,
  createRound,
  drainJackpot,
  getJackpot,
  recentWinners,
  recordEntry,
  recordWinner,
  updateRound,
  type RecentWinner,
} from './db.js';
import { getHolderBalance, getTreasuryLamports, solToLamports } from './solana.js';
import { payWinner } from './payout.js';

export type Phase = 'lobby' | 'intro' | 'culling' | 'duels' | 'champion';

export interface Player {
  wallet: string;
  entries: number;
  tokenAmount: number;
  joinedAt: number;
}

export interface GameState {
  roundId: number | null;
  phase: Phase;
  /** Epoch ms when the current phase ends. */
  phaseEndsAt: number;

  players: { wallet: string; entries: number }[];
  playersCount: number;
  fightersCount: number;

  /** Cumulative ids of everyone knocked out so far. */
  eliminated: string[];
  aliveCount: number;
  /** Ids eliminated by the most recent wave, for the kill feed. */
  lastWave: string[];
  waveIndex: number;
  waveCount: number;

  /** Survivors of the culling, in bracket seed order. */
  finalists: Fighter[];
  /** The duel on screen right now. */
  currentDuel: (Duel & { index: number }) | null;
  /** Duels already fought, so the bracket can be drawn. */
  resolvedDuels: Duel[];
  duelCount: number;

  champion: Fighter | null;
  championPrize: number;
  jackpotWon: boolean;
  jackpotRoll: number;
  jackpotPrize: number;

  potLamports: number;
  prizeLamports: number;
  jackpotLamports: number;
  jackpotOdds: number;

  serverSeedHash: string;
  /** Revealed once settled, so the whole round can be replayed. */
  serverSeed: string | null;
  recentWinners: RecentWinner[];
  demoMode: boolean;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Stable, realistic-looking addresses for simulated entrants in a test game.
 * Derived from the index so the same crowd returns every round.
 */
function demoWallet(index: number): string {
  const digest = createHash('sha256').update(`royale-demo-player:${index}`).digest();
  return new PublicKey(new Uint8Array(digest)).toBase58();
}

/** Deterministic 1-in-N jackpot roll, verifiable from the revealed seed. */
function jackpotRoll(serverSeed: string, wallet: string, entry: number, odds: number): number {
  const digest = sha256(`jackpot:${serverSeed}:${wallet}:${entry}`);
  return Number.parseInt(digest.slice(0, 13), 16) % odds;
}

export class RoyaleEngine extends EventEmitter {
  private roundId: number | null = null;
  private phase: Phase = 'lobby';
  private phaseEndsAt = 0;

  private serverSeed = '';
  private serverSeedHash = '';
  private seedRevealed = false;

  private players = new Map<string, Player>();
  private result: RoyaleResult | null = null;

  private eliminated: string[] = [];
  private lastWave: string[] = [];
  private waveIndex = 0;
  private duelIndex = -1;
  private resolvedDuels: Duel[] = [];

  private champion: Fighter | null = null;
  private championPrize = 0;
  private jackpotWon = false;
  private jackpotRollValue = -1;
  private jackpotPrize = 0;

  private potLamports = 0;
  private prizeLamports = 0;
  private jackpotLamports = 0;
  private recent: RecentWinner[] = [];

  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  async start(): Promise<void> {
    this.jackpotLamports = await getJackpot();
    this.recent = await recentWinners();
    await this.openLobby();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  // -------------------------------------------------------------------------
  // Round lifecycle
  // -------------------------------------------------------------------------

  private async openLobby(): Promise<void> {
    if (this.stopped) return;

    this.serverSeed = randomBytes(32).toString('hex');
    this.serverSeedHash = sha256(this.serverSeed);
    this.seedRevealed = false;

    this.players.clear();
    this.result = null;
    this.eliminated = [];
    this.lastWave = [];
    this.waveIndex = 0;
    this.duelIndex = -1;
    this.resolvedDuels = [];
    this.champion = null;
    this.championPrize = 0;
    this.jackpotWon = false;
    this.jackpotRollValue = -1;
    this.jackpotPrize = 0;

    this.phase = 'lobby';
    this.phaseEndsAt = Date.now() + config.lobbyMs;

    this.potLamports = await this.computePot();
    this.prizeLamports = splitPot(this.potLamports).prize;
    this.roundId = null; // written lazily, on the first join

    await this.seatDemoPlayers();

    this.broadcast('phase');
    this.schedule(config.lobbyMs, () => void this.startIntro());
  }

  /** Test mode only — fills the arena so a round can be watched end to end. */
  private async seatDemoPlayers(): Promise<void> {
    if (config.demoPlayers <= 0 || !config.devFakeHolders) return;
    for (let i = 0; i < config.demoPlayers; i++) await this.join(demoWallet(i));
  }

  private async ensureRoundRow(): Promise<void> {
    if (this.roundId !== null) return;
    const split = splitPot(this.potLamports);
    this.roundId = await createRound({
      serverSeedHash: this.serverSeedHash,
      pattern: 'duel-royale',
      potLamports: this.potLamports,
      prizeLamports: split.prize,
      jackpotAddLamports: split.jackpot,
    });
  }

  private async computePot(): Promise<number> {
    if (config.potSource === 'fixed') return solToLamports(config.roundPotSol);

    const treasury = await getTreasuryLamports();
    const reserve = solToLamports(config.treasuryReserveSol);
    // The jackpot is player money already sitting in the treasury.
    const available = treasury - reserve - this.jackpotLamports;
    if (available <= 0) return solToLamports(config.minRoundPotSol);

    const raw = Math.floor(available * config.potPayoutRatio);
    return Math.max(
      solToLamports(config.minRoundPotSol),
      Math.min(solToLamports(config.maxRoundPotSol), raw),
    );
  }

  /** Everyone's entries, flattened into individual fighters. */
  private buildFighters(): Fighter[] {
    const fighters: Fighter[] = [];
    for (const player of this.players.values()) {
      for (let entry = 0; entry < player.entries; entry++) {
        fighters.push({ wallet: player.wallet, entry });
      }
    }
    return fighters;
  }

  private async startIntro(): Promise<void> {
    if (this.stopped) return;

    // A one-fighter arena has nobody to duel. Recycle instead of crowning
    // someone who never faced an opponent.
    if (this.players.size < 2) {
      await this.openLobby();
      return;
    }

    this.result = resolveRoyale(this.serverSeed, this.buildFighters());
    this.phase = 'intro';
    this.phaseEndsAt = Date.now() + config.introMs;

    await updateRound(this.roundId, {
      status: 'drawing',
      players_count: this.players.size,
      cards_count: this.result.ranking.length,
    });

    console.log(
      `[engine] round ${this.roundId ?? '(local)'} — ${this.players.size} players, ` +
        `${this.result.ranking.length} fighters, ${this.result.waves.length} waves, ` +
        `${this.result.duels.length} duels`,
    );

    this.broadcast('phase');
    this.schedule(config.introMs, () => this.nextWave());
  }

  private nextWave(): void {
    if (this.stopped || !this.result) return;

    if (this.waveIndex >= this.result.waves.length) {
      this.startDuels();
      return;
    }

    const wave = this.result.waves[this.waveIndex] ?? [];
    this.lastWave = wave.map(fighterId);
    this.eliminated.push(...this.lastWave);
    this.waveIndex++;

    this.phase = 'culling';
    this.phaseEndsAt = Date.now() + config.waveMs;
    this.broadcast('wave');
    this.schedule(config.waveMs, () => this.nextWave());
  }

  private startDuels(): void {
    if (this.stopped || !this.result) return;
    this.phase = 'duels';
    this.lastWave = [];
    this.nextDuel();
  }

  private nextDuel(): void {
    if (this.stopped || !this.result) return;

    // Bank the duel that just finished before moving on.
    const finished = this.result.duels[this.duelIndex];
    if (finished) {
      this.resolvedDuels.push(finished);
      const loser =
        finished.winner && fighterId(finished.winner) === fighterId(finished.a as Fighter)
          ? finished.b
          : finished.a;
      if (loser) this.eliminated.push(fighterId(loser));
    }

    this.duelIndex++;

    if (this.duelIndex >= this.result.duels.length) {
      void this.crown();
      return;
    }

    this.phaseEndsAt = Date.now() + config.duelMs;
    this.broadcast('duel');
    this.schedule(config.duelMs, () => this.nextDuel());
  }

  private async crown(): Promise<void> {
    if (this.stopped || !this.result) return;

    this.phase = 'champion';
    this.phaseEndsAt = Date.now() + config.celebrationMs;
    this.seedRevealed = true;
    this.champion = this.result.champion;

    const split = splitPot(this.potLamports);
    // 20% of every pot feeds the progressive jackpot, win or no win.
    this.jackpotLamports = await addToJackpot(split.jackpot);

    if (this.champion) {
      this.championPrize = split.prize;
      this.jackpotRollValue = jackpotRoll(
        this.serverSeed,
        this.champion.wallet,
        this.champion.entry,
        config.jackpotOdds,
      );
      this.jackpotWon = this.jackpotRollValue === 0;

      if (this.jackpotWon) {
        this.jackpotPrize = await drainJackpot(this.roundId);
        this.jackpotLamports = await getJackpot();
        console.log(`[engine] JACKPOT HIT — ${this.jackpotPrize} lamports`);
      }

      const winnerId = await recordWinner({
        roundId: this.roundId ?? 0,
        wallet: this.champion.wallet,
        cardIndex: this.champion.entry,
        ballNumber: null,
        ballsCalled: this.result.ranking.length,
        prizeLamports: this.championPrize,
        jackpotWon: this.jackpotWon,
        jackpotRoll: this.jackpotRollValue,
        jackpotLamports: this.jackpotPrize,
      });
      // Fire and forget: a slow transfer must not stall the arena.
      void payWinner(winnerId, this.champion.wallet, this.championPrize + this.jackpotPrize);

      console.log(
        `[engine] champion ${this.champion.wallet.slice(0, 6)}… wins ${this.championPrize}` +
          (this.jackpotWon ? ` + ${this.jackpotPrize} JACKPOT` : ''),
      );
    }

    await updateRound(this.roundId, {
      status: 'settled',
      server_seed: this.serverSeed,
      settled_at: new Date().toISOString(),
      players_count: this.players.size,
      cards_count: this.result.ranking.length,
    });

    this.recent = await recentWinners();
    this.broadcast('champion');
    this.schedule(config.celebrationMs, () => void this.openLobby());
  }

  private schedule(ms: number, fn: () => void): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(fn, ms);
  }

  // -------------------------------------------------------------------------
  // Joining
  // -------------------------------------------------------------------------

  async join(wallet: string): Promise<
    | { ok: true; entries: number; tokenAmount: number }
    | { ok: false; reason: string; code: string }
  > {
    if (this.phase !== 'lobby') {
      return {
        ok: false,
        code: 'closed',
        reason: 'This round already started — you are in the next one.',
      };
    }

    const existing = this.players.get(wallet);
    if (existing) {
      return { ok: true, entries: existing.entries, tokenAmount: existing.tokenAmount };
    }

    const balance = await getHolderBalance(wallet, true);
    if (!balance.eligible || balance.cards < 1) {
      return {
        ok: false,
        code: 'ineligible',
        reason:
          `You need at least ${config.minTokensToPlay.toLocaleString()} $${config.tokenSymbol} to enter. ` +
          `You hold ${Math.floor(balance.amount).toLocaleString()}.`,
      };
    }

    await this.ensureRoundRow();

    this.players.set(wallet, {
      wallet,
      entries: balance.cards,
      tokenAmount: balance.amount,
      joinedAt: Date.now(),
    });

    await recordEntry({
      roundId: this.roundId,
      wallet,
      cards: balance.cards,
      tokenAmount: balance.amount,
    });

    this.broadcast('join');
    return { ok: true, entries: balance.cards, tokenAmount: balance.amount };
  }

  private totalFighters(): number {
    let total = 0;
    for (const player of this.players.values()) total += player.entries;
    return total;
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  getState(): GameState {
    const duel = this.result?.duels[this.duelIndex];
    const fighters = this.result?.ranking.length ?? this.totalFighters();

    return {
      roundId: this.roundId,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,

      players: [...this.players.values()]
        .sort((a, b) => b.entries - a.entries)
        .map((p) => ({ wallet: p.wallet, entries: p.entries })),
      playersCount: this.players.size,
      fightersCount: fighters,

      eliminated: this.eliminated,
      aliveCount: Math.max(0, fighters - this.eliminated.length),
      lastWave: this.lastWave,
      waveIndex: this.waveIndex,
      waveCount: this.result?.waves.length ?? 0,

      finalists: this.result?.finalists ?? [],
      currentDuel: duel ? { ...duel, index: this.duelIndex } : null,
      resolvedDuels: this.resolvedDuels,
      duelCount: this.result?.duels.length ?? 0,

      champion: this.champion,
      championPrize: this.championPrize,
      jackpotWon: this.jackpotWon,
      jackpotRoll: this.jackpotRollValue,
      jackpotPrize: this.jackpotPrize,

      potLamports: this.potLamports,
      prizeLamports: this.prizeLamports,
      jackpotLamports: this.jackpotLamports,
      jackpotOdds: config.jackpotOdds,

      serverSeedHash: this.serverSeedHash,
      serverSeed: this.seedRevealed ? this.serverSeed : null,
      recentWinners: this.recent,
      demoMode: config.devFakeHolders,
    };
  }

  private broadcast(reason: string): void {
    this.emit('state', { reason, state: this.getState() });
  }
}

export const engine = new RoyaleEngine();
