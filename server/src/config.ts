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

export const config = {
  // --- server -------------------------------------------------------------
  port: num('PORT', 8080),
  // Comma separated list of allowed browser origins. "*" allows everything.
  corsOrigins: list('CORS_ORIGINS', ['*']),
  adminToken: optional('ADMIN_TOKEN'),

  // --- token / eligibility ------------------------------------------------
  /** The pump.fun mint address (the "CA"). */
  tokenMint: str('TOKEN_MINT'),
  tokenSymbol: str('TOKEN_SYMBOL', 'COW'),
  tokenName: str('TOKEN_NAME', 'Cash Cow'),
  /** Total token supply. pump.fun mints 1,000,000,000 by default. */
  tokenSupply: num('TOKEN_SUPPLY', 1_000_000_000),

  // --- solana -------------------------------------------------------------
  rpcUrl: str('SOLANA_RPC_URL', 'https://api.mainnet-beta.solana.com'),
  /** Cache holder balance lookups for this many seconds. */
  holderCacheSeconds: num('HOLDER_CACHE_SECONDS', 30),

  // --- airdrop ------------------------------------------------------------
  /** How often to snapshot and pay out. Five minutes by default. */
  airdropIntervalMs: num('AIRDROP_INTERVAL_MS', 5 * 60_000),
  /** Share of the unreserved treasury handed out each drop. */
  airdropPayoutRatio: num('AIRDROP_PAYOUT_RATIO', 1),
  /** Don't bother dropping below this — fees would eat it. */
  airdropMinPoolLamports: num('AIRDROP_MIN_POOL_LAMPORTS', 10_000_000),
  /** Minimum whole tokens a wallet needs to be in the snapshot. */
  airdropMinTokens: num('AIRDROP_MIN_TOKENS', 1),
  /** Skip allocations smaller than this — dust costs more to send than it's worth. */
  airdropMinLamports: num('AIRDROP_MIN_LAMPORTS', 5_000),
  /** Wallets to leave out: bonding curve, LP, anything that isn't a person. */
  excludeWallets: list('EXCLUDE_WALLETS', []),

  // --- treasury -----------------------------------------------------------
  /** Wallet you claim pump.fun creator fees into. The drop pays out of it. */
  treasuryWallet: optional('TREASURY_WALLET'),
  /** Never touch this much SOL — rent and transaction fees. */
  treasuryReserveSol: num('TREASURY_RESERVE_SOL', 0.05),

  // --- supabase -----------------------------------------------------------
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseServiceKey: optional('SUPABASE_SERVICE_ROLE_KEY'),

  // --- payouts (opt-in) ---------------------------------------------------
  /**
   * When false the engine runs as a DRY RUN: it snapshots, computes every
   * allocation and records the drop, but sends nothing. Turn it on only once
   * you have tested on devnet — it puts a spending key on the server.
   */
  autoPayout: bool('AUTO_PAYOUT', false),
  /** base58 secret key of the treasury wallet. Only read when AUTO_PAYOUT=true. */
  payoutSecretKey: optional('PAYOUT_SECRET_KEY'),

  // --- local development --------------------------------------------------
  /**
   * DEV ONLY. Skips the RPC and invents a holder list, so the site can be
   * driven end to end without an RPC key or a real token. Never enable this on
   * a live deployment — the numbers on screen would be fiction.
   */
  devFakeHolders: bool('DEV_FAKE_HOLDERS', false),

} as const;


/** Public, non-secret config the frontend is allowed to read. */
export function publicConfig() {
  return {
    tokenMint: config.tokenMint,
    tokenSymbol: config.tokenSymbol,
    tokenName: config.tokenName,
    tokenSupply: config.tokenSupply,
    airdropIntervalMs: config.airdropIntervalMs,
    airdropMinTokens: config.airdropMinTokens,
    treasuryWallet: config.treasuryWallet ?? null,
    demoMode: config.devFakeHolders,
  };
}
