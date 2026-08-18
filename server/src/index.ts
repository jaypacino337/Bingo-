import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config, publicConfig } from './config.js';
import { airdrop } from './airdrop.js';
import { getHolderBalance, isValidWallet } from './solana.js';
import { dbEnabled, recentDrops, walletHistory } from './db.js';
import { preflight } from './preflight.js';

// Refuse to start on bad config rather than failing at the first drop.
preflight();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));

// ---------------------------------------------------------------------------
// Rate limiting — RPC lookups are the expensive part.
// ---------------------------------------------------------------------------
const hits = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10_000;
const MAX_HITS = 20;

function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  entry.count++;
  if (entry.count > MAX_HITS) {
    res.status(429).json({ error: 'Slow down a second.' });
    return;
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (now > entry.resetAt) hits.delete(key);
}, 60_000).unref();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Identifies the service at the bare domain — see the deploy notes. */
app.get('/', (_req, res) => {
  const state = airdrop.getState();
  res.json({
    service: 'cash-cow-airdrop-server',
    ok: true,
    message: 'This is the airdrop server. The website is deployed separately on Vercel.',
    phase: state.phase,
    live: state.live,
    nextRunAt: state.nextRunAt,
    supabase: dbEnabled,
    endpoints: ['/health', '/api/config', '/api/state', '/api/holder/:wallet', '/api/drops'],
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    supabase: dbEnabled,
    live: airdrop.getState().live,
    phase: airdrop.getState().phase,
  });
});

app.get('/api/config', (_req, res) => res.json(publicConfig()));
app.get('/api/state', (_req, res) => res.json(airdrop.getState()));
app.get('/api/drops', async (_req, res) => res.json(await recentDrops(20)));

/** What a wallet holds, and what it's due in the next drop. */
app.get('/api/holder/:wallet', rateLimit, async (req, res) => {
  const wallet = String(req.params.wallet ?? '').trim();
  if (!isValidWallet(wallet)) {
    res.status(400).json({ error: 'That does not look like a Solana wallet address.' });
    return;
  }
  try {
    const balance = await getHolderBalance(wallet);
    const share = airdrop.shareFor(wallet);
    const history = await walletHistory(wallet);
    res.json({
      wallet: balance.wallet,
      amount: balance.amount,
      eligible: balance.amount >= config.airdropMinTokens,
      minTokens: config.airdropMinTokens,
      nextDropLamports: share?.lamports ?? 0,
      sharePercent: share ? share.share * 100 : 0,
      totalEarnedLamports: history.total,
    });
  } catch (err) {
    console.error('[api] holder lookup failed:', err);
    res.status(502).json({ error: 'Could not read that wallet from the chain.' });
  }
});

/** Fire a drop by hand. Guarded by ADMIN_TOKEN when one is set. */
app.post('/api/drop', async (req, res) => {
  if (config.adminToken) {
    const provided = req.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (provided !== config.adminToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }
  const summary = await airdrop.runDrop(true);
  res.json({ ok: true, summary });
});

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

interface Client extends WebSocket {
  isAlive?: boolean;
}

function send(ws: WebSocket, type: string, payload: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, payload }));
}

wss.on('connection', (ws: Client) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });
  send(ws, 'config', publicConfig());
  send(ws, 'state', airdrop.getState());

  ws.on('message', (raw) => {
    let msg: { type?: string };
    try {
      msg = JSON.parse(String(raw)) as { type?: string };
    } catch {
      return;
    }
    if (msg.type === 'ping') send(ws, 'pong', { t: Date.now() });
    if (msg.type === 'sync') send(ws, 'state', airdrop.getState());
  });
});

const heartbeat = setInterval(() => {
  for (const client of wss.clients as Set<Client>) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30_000);
heartbeat.unref();

airdrop.on('state', (state: unknown) => {
  const message = JSON.stringify({ type: 'state', payload: state });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

server.listen(config.port, () => {
  console.log(`[server] listening on :${config.port}`);
  console.log(`[server] mint ${config.tokenMint}`);
  console.log(
    `[server] dropping every ${Math.round(config.airdropIntervalMs / 1000)}s to holders of ` +
      `$${config.tokenSymbol}`,
  );
  void airdrop.start();
});

function shutdown(signal: string): void {
  console.log(`[server] ${signal} received, shutting down`);
  airdrop.stop();
  clearInterval(heartbeat);
  for (const client of wss.clients) client.close(1001, 'server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
