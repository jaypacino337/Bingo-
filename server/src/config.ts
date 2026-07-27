import 'dotenv/config';

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}

function optional(key: string): string | undefined {
  const v = process.env[key];
  return v === undefined || v === '' ? undefined : v;
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Env var ${key} must be a number, got "${v}"`);
  return n;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function list(key: string, fallback: string[]): string[] {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export const LAMPORTS_PER_SOL = 1_000_000_000;

export type WinPattern = 'line' | 'x' | 'full';

function pattern(): WinPattern {
  // "Eyes down for a full house" — the site copy promises a blackout game.
  const v = (process.env.WIN_PATTERN ?? 'full').toLowerCase();
  if (v === 'line' || v === 'x' || v === 'full') return v;
  throw new Error(`WIN_PATTERN must be one of line|x|full, got "${v}"`);
}

export type PotSource = 'creator_fees' | 'fixed';

function potSource(): PotSource {
  const v = (process.env.POT_SOURCE ?? 'creator_fees').toLowerCase();
  if (v === 'creator_fees' || v === 'fixed') return v;
  throw new Error(`POT_SOURCE must be creator_fees|fixed, got "${v}"`);
}

export const config = {
  // --- server -------------------------------------------------------------
  port: num('PORT', 8080),
  // Comma separated list of allowed browser origins. "*" allows everything.
  corsOrigins: list('CORS_ORIGINS', ['*']),
  adminToken: optional('ADMIN_TOKEN'),

  // --- token / eligibility ------------------------------------------------
  /** The pump.fun mint address (the "CA"). */
  tokenMint: str('TOKEN_MINT'),
  tokenSymbol: str('TOKEN_SYMBOL', 'BINGO'),
  tokenName: str('TOKEN_NAME', 'Onchain Bingo'),
  /** How many whole tokens grant one bingo card. */
  tokensPerCard: num('TOKENS_PER_CARD', 1_000_000),
  /** Minimum whole tokens a wallet must hold to enter at all. */
  minTokensToPlay: num('MIN_TOKENS_TO_PLAY', 1_000_000),
  /** Total token supply. pump.fun mints 1,000,000,000 by default. */
  tokenSupply: num('TOKEN_SUPPLY', 1_000_000_000),
  /**
   * Max share of supply any one wallet is allowed to hold, as a percent.
   * The card cap is derived from this so a whale cannot dominate a round.
   */
  maxWalletPercent: num('MAX_WALLET_PERCENT', 5),
  /**
   * Explicit card cap. Leave at 0 to derive it from MAX_WALLET_PERCENT —
   * 5% of a 1B supply is 50,000,000 tokens, which at 1M per card is 50 cards.
   * Set a number here to override. -1 means genuinely uncapped.
   */
  maxCardsOverride: num('MAX_CARDS_PER_WALLET', 0),

  // --- solana -------------------------------------------------------------
  rpcUrl: str('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
  /** Cache holder balance lookups for this many seconds. */
  holderCacheSeconds: num('HOLDER_CACHE_SECONDS', 30),

  // --- round timing (ms) --------------------------------------------------
  /** Join window before the balls start dropping. */
  lobbyMs: num('LOBBY_MS', 30_000),
  /** Gap between balls. Real casino bingo sits around 2.5s. */
  ballIntervalMs: num('BALL_INTERVAL_MS', 2_600),
  /** Dead air before the first ball, for the "get ready" beat. */
  preRollMs: num('PRE_ROLL_MS', 3_000),
  /** How long the winner celebration stays on screen. */
  celebrationMs: num('CELEBRATION_MS', 15_000),

  // --- prizes -------------------------------------------------------------
  winPattern: pattern(),
  /**
   * Where the round pot comes from.
   *   'creator_fees' — pot is funded from pump.fun creator fees sitting in the
   *                    treasury wallet. Claim fees to TREASURY_WALLET (pump.fun
   *                    "claim creator fees") and the engine sizes each round's
   *                    pot from the unreserved balance.
   *   'fixed'        — every round has the same pot (ROUND_POT_SOL). Useful for
   *                    testing before the token has any volume.
   */
  potSource: potSource(),
  /** Pot per round in SOL. Only used when POT_SOURCE=fixed. */
  roundPotSol: num('ROUND_POT_SOL', 1),
  /** Wallet holding claimed pump.fun creator fees + the jackpot float. */
  treasuryWallet: optional('TREASURY_WALLET'),
  /**
   * Fraction of the *available* (unreserved, non-jackpot) treasury balance to
   * put up as the pot each round. 0.1 = pay out 10% of the float per round,
   * which makes the pot grow with volume and never drains to zero.
   */
  potPayoutRatio: num('POT_PAYOUT_RATIO', 0.1),
  /** Never touch this much SOL — rent, tx fees, headroom. */
  treasuryReserveSol: num('TREASURY_RESERVE_SOL', 0.05),
  /** Clamp the computed pot so rounds stay sane. */
  minRoundPotSol: num('MIN_ROUND_POT_SOL', 0.01),
  maxRoundPotSol: num('MAX_ROUND_POT_SOL', 100),
  /** Share of the pot paid to the round winner(s). */
  prizeShare: num('PRIZE_SHARE', 0.8),
  /** Share of the pot pushed into the progressive jackpot. */
  jackpotShare: num('JACKPOT_SHARE', 0.2),
  /** 1-in-N shot at the jackpot, rolled after every win. */
  jackpotOdds: num('JACKPOT_ODDS', 25),

  // --- supabase -----------------------------------------------------------
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceKey: optional('SUPABASE_SERVICE_ROLE_KEY'),

  // --- payouts (opt-in) ---------------------------------------------------
  /** When false, wins are recorded as `pending` for manual settlement. */
  autoPayout: bool('AUTO_PAYOUT', false),
  /** base58 secret key of the treasury wallet. Only read when AUTO_PAYOUT=true. */
  payoutSecretKey: optional('PAYOUT_SECRET_KEY'),

  // --- local development --------------------------------------------------
  /**
   * DEV ONLY. Skips the RPC and hands every wallet a deterministic pretend
   * balance, so you can play through a whole round without an RPC key or any
   * real tokens. Never enable this on a live deployment — it would let anyone
   * with an address into the game.
   */
  devFakeHolders: bool('DEV_FAKE_HOLDERS', false),
} as const;

if (Math.abs(config.prizeShare + config.jackpotShare - 1) > 1e-9) {
  throw new Error(
    `PRIZE_SHARE (${config.prizeShare}) + JACKPOT_SHARE (${config.jackpotShare}) must equal 1`,
  );
}

if (config.potSource === 'creator_fees' && !config.treasuryWallet) {
  throw new Error('POT_SOURCE=creator_fees requires TREASURY_WALLET to be set');
}

/**
 * The most cards one wallet can play. Derived from the max-wallet rule unless
 * explicitly overridden. 0 means "no cap" internally.
 */
export const maxCardsPerWallet: number = (() => {
  if (config.maxCardsOverride === -1) return 0; // uncapped, on purpose
  if (config.maxCardsOverride > 0) return config.maxCardsOverride;
  const maxTokens = config.tokenSupply * (config.maxWalletPercent / 100);
  return Math.max(1, Math.floor(maxTokens / config.tokensPerCard));
})();

/** Split a pot into the winner's prize and the jackpot contribution. */
export function splitPot(lamports: number): { prize: number; jackpot: number } {
  const prize = Math.round(lamports * config.prizeShare);
  return { prize, jackpot: lamports - prize };
}

/** Public, non-secret config the frontend is allowed to read. */
export function publicConfig() {
  return {
    tokenMint: config.tokenMint,
    tokenSymbol: config.tokenSymbol,
    tokenName: config.tokenName,
    tokensPerCard: config.tokensPerCard,
    minTokensToPlay: config.minTokensToPlay,
    maxCardsPerWallet,
    maxWalletPercent: config.maxWalletPercent,
    winPattern: config.winPattern,
    ballIntervalMs: config.ballIntervalMs,
    lobbyMs: config.lobbyMs,
    jackpotOdds: config.jackpotOdds,
    prizeShare: config.prizeShare,
    jackpotShare: config.jackpotShare,
    potSource: config.potSource,
    treasuryWallet: config.treasuryWallet ?? null,
  };
}
