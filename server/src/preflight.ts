import { PublicKey } from '@solana/web3.js';
import { config } from './config.js';

/**
 * Catch bad configuration at boot instead of at the first player.
 *
 * The failure this exists to prevent: leaving a placeholder like
 * "YOUR_PUMP_FUN_CA_HERE" in TOKEN_MINT. The server starts happily, then every
 * holder lookup throws deep inside the RPC client and surfaces as a generic
 * 502 — so the site looks broken with nothing in the logs pointing at the
 * cause. Better to refuse to start and say exactly which variable is wrong.
 */

function isPlaceholder(value: string): boolean {
  const v = value.trim().toLowerCase();
  return (
    v.length === 0 ||
    v.includes('your') ||
    v.includes('here') ||
    v.includes('replace') ||
    v.includes('xxx') ||
    v.startsWith('<')
  );
}

function isValidPubkey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function preflight(): void {
  const problems: string[] = [];
  const warnings: string[] = [];

  // --- TOKEN_MINT ---------------------------------------------------------
  if (isPlaceholder(config.tokenMint)) {
    problems.push(
      `TOKEN_MINT is still a placeholder ("${config.tokenMint}"). Set it to your pump.fun mint address (the CA).`,
    );
  } else if (!isValidPubkey(config.tokenMint)) {
    problems.push(
      `TOKEN_MINT is not a valid Solana address ("${config.tokenMint}"). It should be a base58 string, roughly 32-44 characters.`,
    );
  }

  // --- TREASURY_WALLET ----------------------------------------------------
  const treasury = config.treasuryWallet ?? '';
  if (isPlaceholder(treasury)) {
    problems.push(
      `TREASURY_WALLET is not set. This is the wallet you claim pump.fun creator fees into — the drop pays out of its balance.`,
    );
  } else if (!isValidPubkey(treasury)) {
    problems.push(`TREASURY_WALLET is not a valid Solana address ("${treasury}").`);
  }

  // --- airdrop sanity -----------------------------------------------------
  if (config.airdropIntervalMs < 60_000) {
    warnings.push(
      `AIRDROP_INTERVAL_MS is ${config.airdropIntervalMs}ms. Each drop scans every token account and sends a batch of transactions — under a minute you will hit RPC limits and spend more on fees than you hand out.`,
    );
  }
  if (config.autoPayout) {
    warnings.push(
      'AUTO_PAYOUT is ON. This server holds a key that can spend the treasury and will send real SOL on a timer. Test on devnet first.',
    );
  } else {
    warnings.push('Running as a DRY RUN — drops are computed and recorded but nothing is sent.');
  }

  // --- RPC ----------------------------------------------------------------
  if (isPlaceholder(config.rpcUrl) || !/^https?:\/\//.test(config.rpcUrl)) {
    problems.push(
      `SOLANA_RPC_URL is not a usable URL ("${config.rpcUrl}"). It must start with https://`,
    );
  } else if (config.rpcUrl.includes('api.mainnet-beta.solana.com') && !config.devFakeHolders) {
    warnings.push(
      'SOLANA_RPC_URL is the public endpoint. It does NOT allow the getProgramAccounts scan a holder snapshot needs — get a Helius, QuickNode or Triton endpoint or drops will fail.',
    );
  }

  // --- Supabase -----------------------------------------------------------
  if (config.supabaseUrl && isPlaceholder(config.supabaseUrl)) {
    problems.push(`SUPABASE_URL is still a placeholder ("${config.supabaseUrl}").`);
  }
  if (config.supabaseServiceKey && isPlaceholder(config.supabaseServiceKey)) {
    problems.push('SUPABASE_SERVICE_ROLE_KEY is still a placeholder.');
  }
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    warnings.push(
      'Supabase is not configured — drop history will not be kept.',
    );
  }

  // --- Dangerous in production -------------------------------------------
  if (config.devFakeHolders) {
    warnings.push(
      'DEV_FAKE_HOLDERS is ON. Balances shown on the site are FAKE. Never leave this on for a live deployment.',
    );
  }

  if (config.corsOrigins.includes('*')) {
    warnings.push('CORS_ORIGINS is "*" — lock it to your Vercel domain before launch.');
  }

  for (const warning of warnings) console.warn(`[preflight] WARNING: ${warning}`);

  if (problems.length > 0) {
    console.error('\n' + '='.repeat(72));
    console.error('  CONFIGURATION ERROR — the airdrop server cannot start');
    console.error('='.repeat(72));
    for (const problem of problems) console.error(`\n  • ${problem}`);
    console.error(
      '\n  Fix these in Railway → Variables, then redeploy.\n' + '='.repeat(72) + '\n',
    );
    process.exit(1);
  }

  console.log('[preflight] configuration looks good');
}
