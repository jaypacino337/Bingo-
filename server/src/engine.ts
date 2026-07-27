import { createHash, randomBytes } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { config, splitPot } from './config.js';
import {
  drawOrder,
  evaluateCard,
  generateCard,
  letterFor,
  type Card,
} from './bingo.js';
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
import { PublicKey } from '@solana/web3.js';
import { getHolderBalance, getTreasuryLamports, solToLamports } from './solana.js';
import { payWinner } from './payout.js';

export type Phase = 'lobby' | 'preroll' | 'drawing' | 'celebration';

export interface Player {
  wallet: string;
  cards: number;
  tokenAmount: number;
  joinedAt: number;
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

export interface HotCard {
  wallet: string;
  cardIndex: number;
  remaining: number;
}

export interface GameState {
  roundId: number | null;
  phase: Phase;
  pattern: string;
  /** Epoch ms when the current phase ends. */
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
  hotCards: HotCard[];
  winners: Winner[];
  serverSeedHash: string;
  /** Only populated once the round has settled, so draws can be verified. */
  serverSeed: string | null;
  recentWinners: RecentWinner[];
  /** True when balances are simulated — the UI shows a TEST GAME banner. */
  demoMode: boolean;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Stable, realistic-looking addresses for the simulated entrants used in a
 * test game. Derived from the index so the same crowd — and the same cards —
 * comes back every round instead of a fresh set of strangers each time.
 */
function demoWallet(index: number): string {
  const digest = createHash('sha256').update(`bingo-demo-player:${index}`).digest();
  return new PublicKey(new Uint8Array(digest)).toBase58();
}

/** Deterministic 1-in-N jackpot roll, verifiable from the revealed seed. */
function jackpotRoll(serverSeed: string, wallet: string, cardIndex: number, odds: number): number {
  const digest = sha256(`jackpot:${serverSeed}:${wallet}:${cardIndex}`);
  // 52 bits is well within Number's exact-integer range.
  const slice = Number.parseInt(digest.slice(0, 13), 16);
  return slice % odds;
}

export class BingoEngine extends EventEmitter {
  private roundId: number | null = null;
  private phase: Phase = 'lobby';
  private phaseEndsAt = 0;
  private serverSeed = '';
  private serverSeedHash = '';
  private seedRevealed = false;
  private order: number[] = [];
  private draws: number[] = [];
  private players = new Map<string, Player>();
  private cards = new Map<string, Card>(); // key: `${wallet}:${index}`
  private winners: Winner[] = [];
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
    this.order = drawOrder(this.serverSeed);
    this.draws = [];
    this.players.clear();
    this.cards.clear();
    this.winners = [];
    this.phase = 'lobby';
    this.phaseEndsAt = Date.now() + config.lobbyMs;

    this.potLamports = await this.computePot();
    const split = splitPot(this.potLamports);
    this.prizeLamports = split.prize;
    this.roundId = null; // written lazily, on the first join

    console.log(
      `[engine] lobby open — pot ${this.potLamports} lamports ` +
        `(prize ${split.prize}, jackpot +${split.jackpot})`,
    );

    await this.seatDemoPlayers();

    this.broadcast('phase');
    this.schedule(config.lobbyMs, () => void this.startPreRoll());
  }

  /** Test mode only — fills the floor so a round can be watched end to end. */
  private async seatDemoPlayers(): Promise<void> {
    if (config.demoPlayers <= 0 || !config.devFakeHolders) return;
    for (let i = 0; i < config.demoPlayers; i++) {
      await this.join(demoWallet(i));
    }
    console.log(`[engine] seated ${config.demoPlayers} simulated entrants (test game)`);
  }

  /**
   * Persist the round on first join. An empty lobby recycles every LOBBY_MS,
   * and we don't want a row in Supabase for each of those idle spins.
   */
  private async ensureRoundRow(): Promise<void> {
    if (this.roundId !== null) return;
    const split = splitPot(this.potLamports);
    this.roundId = await createRound({
      serverSeedHash: this.serverSeedHash,
      pattern: config.winPattern,
      potLamports: this.potLamports,
      prizeLamports: split.prize,
      jackpotAddLamports: split.jackpot,
    });
  }

  /**
   * Pot sizing. With POT_SOURCE=creator_fees the pot is a slice of whatever
   * pump.fun creator fees have been claimed into the treasury, minus the
   * jackpot already owed to players and a small reserve for tx fees.
   */
  private async computePot(): Promise<number> {
    if (config.potSource === 'fixed') {
      return solToLamports(config.roundPotSol);
    }

    const treasury = await getTreasuryLamports();
    const reserve = solToLamports(config.treasuryReserveSol);
    // The jackpot is player money already sitting in the treasury — never
    // recycle it into a round pot.
    const available = treasury - reserve - this.jackpotLamports;
    if (available <= 0) {
      console.warn(
        `[engine] treasury has no unreserved balance (bal=${treasury}, jackpot=${this.jackpotLamports}) — ` +
          `pot falls back to MIN_ROUND_POT_SOL`,
      );
      return solToLamports(config.minRoundPotSol);
    }

    const raw = Math.floor(available * config.potPayoutRatio);
    const min = solToLamports(config.minRoundPotSol);
    const max = solToLamports(config.maxRoundPotSol);
    return Math.max(min, Math.min(max, raw));
  }

  private async startPreRoll(): Promise<void> {
    if (this.stopped) return;

    if (this.players.size === 0) {
      // Nobody joined — recycle straight back into a fresh lobby rather than
      // burning a pot on an empty room. Nothing was persisted, so nothing to
      // clean up.
      await this.openLobby();
      return;
    }

    this.phase = 'preroll';
    this.phaseEndsAt = Date.now() + config.preRollMs;
    await updateRound(this.roundId, {
      status: 'drawing',
      players_count: this.players.size,
      cards_count: this.totalCards(),
    });
    this.broadcast('phase');
    this.schedule(config.preRollMs, () => this.startDrawing());
  }

  private startDrawing(): void {
    if (this.stopped) return;
    this.phase = 'drawing';
    this.phaseEndsAt = Date.now() + config.ballIntervalMs;
    this.broadcast('phase');
    this.schedule(config.ballIntervalMs, () => void this.drawBall());
  }

  private async drawBall(): Promise<void> {
    if (this.stopped) return;

    const ball = this.order[this.draws.length];
    if (ball === undefined) {
      // All 75 balls called with no winner. Only reachable with an exotic
      // pattern config; settle with no winner and roll the pot forward.
      console.warn('[engine] exhausted all 75 balls with no winner');
      await this.settle();
      return;
    }

    this.draws.push(ball);
    this.phaseEndsAt = Date.now() + config.ballIntervalMs;

    const drawn = new Set(this.draws);
    const winners: Winner[] = [];
    const hot: HotCard[] = [];

    for (const [key, card] of this.cards) {
      const sep = key.lastIndexOf(':');
      const wallet = key.slice(0, sep);
      const cardIndex = Number(key.slice(sep + 1));
      const result = evaluateCard(card, drawn, config.winPattern);

      if (result.won) {
        winners.push({
          wallet,
          cardIndex,
          ballNumber: ball,
          ballsCalled: this.draws.length,
          prizeLamports: 0, // filled in below once we know how many split it
          jackpotWon: false,
          jackpotRoll: -1,
          jackpotLamports: 0,
          line: result.completed[0] ?? [],
        });
      } else if (result.remaining <= 3) {
        hot.push({ wallet, cardIndex, remaining: result.remaining });
      }
    }

    this.hotCards = hot.sort((a, b) => a.remaining - b.remaining).slice(0, 8);

    this.emit('ball', { ball, letter: letterFor(ball), index: this.draws.length });
    this.broadcast('ball');

    if (winners.length > 0) {
      this.winners = winners;
      await this.settle();
      return;
    }

    this.schedule(config.ballIntervalMs, () => void this.drawBall());
  }

  private hotCards: HotCard[] = [];

  private async settle(): Promise<void> {
    if (this.stopped) return;

    this.phase = 'celebration';
    this.phaseEndsAt = Date.now() + config.celebrationMs;
    this.seedRevealed = true;

    const split = splitPot(this.potLamports);
    // 20% of every pot feeds the progressive jackpot, win or no win.
    this.jackpotLamports = await addToJackpot(split.jackpot);

    if (this.winners.length > 0) {
      const share = Math.floor(split.prize / this.winners.length);

      // Each winning card rolls its own 1-in-N shot at the jackpot.
      const hitters: Winner[] = [];
      for (const w of this.winners) {
        w.prizeLamports = share;
        w.jackpotRoll = jackpotRoll(this.serverSeed, w.wallet, w.cardIndex, config.jackpotOdds);
        w.jackpotWon = w.jackpotRoll === 0;
        if (w.jackpotWon) hitters.push(w);
      }

      if (hitters.length > 0) {
        const pool = await drainJackpot(this.roundId);
        const jackpotShare = Math.floor(pool / hitters.length);
        for (const w of hitters) w.jackpotLamports = jackpotShare;
        this.jackpotLamports = await getJackpot();
        console.log(
          `[engine] JACKPOT HIT — ${hitters.length} winner(s) split ${pool} lamports`,
        );
      }

      for (const w of this.winners) {
        const winnerId = await recordWinner({
          roundId: this.roundId ?? 0,
          wallet: w.wallet,
          cardIndex: w.cardIndex,
          ballNumber: w.ballNumber,
          ballsCalled: w.ballsCalled,
          prizeLamports: w.prizeLamports,
          jackpotWon: w.jackpotWon,
          jackpotRoll: w.jackpotRoll,
          jackpotLamports: w.jackpotLamports,
        });
        // Fire and forget: a slow or failed transfer must not stall the room.
        void payWinner(winnerId, w.wallet, w.prizeLamports + w.jackpotLamports);
      }

      console.log(
        `[engine] round ${this.roundId ?? '(local)'} won by ${this.winners
          .map((w) => `${w.wallet.slice(0, 4)}…#${w.cardIndex}`)
          .join(', ')} on ball ${this.draws.at(-1)} (${this.draws.length} called)`,
      );
    }

    await updateRound(this.roundId, {
      status: 'settled',
      server_seed: this.serverSeed,
      draws: this.draws,
      settled_at: new Date().toISOString(),
      players_count: this.players.size,
      cards_count: this.totalCards(),
    });

    this.recent = await recentWinners();
    this.broadcast('settled');
    this.schedule(config.celebrationMs, () => void this.openLobby());
  }

  private schedule(ms: number, fn: () => void): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(fn, ms);
  }

  // -------------------------------------------------------------------------
  // Joining
  // -------------------------------------------------------------------------

  /**
   * Add a wallet to the current round. Only valid during the lobby phase —
   * joining mid-draw would let someone pick a card after seeing the balls.
   */
  async join(wallet: string): Promise<
    | { ok: true; cards: number; tokenAmount: number }
    | { ok: false; reason: string; code: string }
  > {
    if (this.phase !== 'lobby') {
      return { ok: false, code: 'closed', reason: 'Round already started — you are in the next one.' };
    }

    const existing = this.players.get(wallet);
    if (existing) {
      return { ok: true, cards: existing.cards, tokenAmount: existing.tokenAmount };
    }

    const balance = await getHolderBalance(wallet, true);
    if (!balance.eligible || balance.cards < 1) {
      return {
        ok: false,
        code: 'ineligible',
        reason:
          `You need at least ${config.minTokensToPlay.toLocaleString()} $${config.tokenSymbol} to play. ` +
          `You hold ${Math.floor(balance.amount).toLocaleString()}.`,
      };
    }

    await this.ensureRoundRow();

    this.players.set(wallet, {
      wallet,
      cards: balance.cards,
      tokenAmount: balance.amount,
      joinedAt: Date.now(),
    });
    for (let i = 0; i < balance.cards; i++) {
      this.cards.set(`${wallet}:${i}`, generateCard(wallet, i));
    }

    await recordEntry({
      roundId: this.roundId,
      wallet,
      cards: balance.cards,
      tokenAmount: balance.amount,
    });

    this.broadcast('join');
    return { ok: true, cards: balance.cards, tokenAmount: balance.amount };
  }

  private totalCards(): number {
    let total = 0;
    for (const p of this.players.values()) total += p.cards;
    return total;
  }

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  getState(): GameState {
    const last = this.draws.at(-1) ?? null;
    return {
      roundId: this.roundId,
      phase: this.phase,
      pattern: config.winPattern,
      phaseEndsAt: this.phaseEndsAt,
      draws: this.draws,
      lastBall: last,
      lastLetter: last === null ? null : letterFor(last),
      ballsCalled: this.draws.length,
      potLamports: this.potLamports,
      prizeLamports: this.prizeLamports,
      jackpotLamports: this.jackpotLamports,
      jackpotOdds: config.jackpotOdds,
      players: [...this.players.values()]
        .sort((a, b) => b.cards - a.cards)
        .map((p) => ({ wallet: p.wallet, cards: p.cards })),
      playersCount: this.players.size,
      cardsCount: this.totalCards(),
      hotCards: this.hotCards,
      winners: this.winners,
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

export const engine = new BingoEngine();
