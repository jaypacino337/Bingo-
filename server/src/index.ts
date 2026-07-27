import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config, publicConfig } from './config.js';
import { engine } from './engine.js';
import { getHolderBalance, isValidWallet } from './solana.js';
import { dbEnabled, leaderboard, recentWinners } from './db.js';
import { payoutEnabled } from './payout.js';
import { preflight } from './preflight.js';

// Refuse to start on bad config rather than failing at the first player.
preflight();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(
  cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  }),
);

// ---------------------------------------------------------------------------
// Rate limiting — RPC lookups are the expensive part, so guard /holder.
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

// Keep the map from growing without bound on a long-lived process.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (now > entry.resetAt) hits.delete(key);
}, 60_000).unref();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Identifies the service at the bare domain. Without this, hitting the root of
 * a misconfigured deploy gives an anonymous 404 and there is no way to tell
 * "wrong app deployed here" from "nothing deployed here".
 */
app.get('/', (_req, res) => {
  const state = engine.getState();
  res.json({
    service: 'bingo-fun-game-server',
    ok: true,
    message: 'This is the game server. The website is deployed separately on Vercel.',
    phase: state.phase,
    players: state.playersCount,
    cards: state.cardsCount,
    supabase: dbEnabled,
    endpoints: ['/health', '/api/config', '/api/state', '/api/holder/:wallet', '/api/join', '/ws'],
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    supabase: dbEnabled,
    autoPayout: payoutEnabled(),
    phase: engine.getState().phase,
  });
});

app.get('/api/config', (_req, res) => {
  res.json(publicConfig());
});

app.get('/api/state', (_req, res) => {
  res.json(engine.getState());
});

/** Look up a wallet's holdings and how many cards it gets. */
app.get('/api/holder/:wallet', rateLimit, async (req, res) => {
  const wallet = String(req.params.wallet ?? '').trim();
  if (!isValidWallet(wallet)) {
    res.status(400).json({ error: 'That does not look like a Solana wallet address.' });
    return;
  }
  try {
    const balance = await getHolderBalance(wallet);
    res.json({
      wallet: balance.wallet,
      amount: balance.amount,
      cards: balance.cards,
      eligible: balance.eligible,
      toNextCard: balance.toNextCard,
      tokensPerCard: config.tokensPerCard,
      minTokensToPlay: config.minTokensToPlay,
    });
  } catch (err) {
    console.error('[api] holder lookup failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      error: 'Could not read that wallet from the chain. The RPC may be rate limited or down.',
      detail,
    });
  }
});

/** Enter the current round. Only works while the lobby is open. */
app.post('/api/join', rateLimit, async (req, res) => {
  const wallet = String((req.body as { wallet?: unknown })?.wallet ?? '').trim();
  if (!isValidWallet(wallet)) {
    res.status(400).json({ error: 'That does not look like a Solana wallet address.' });
    return;
  }
  try {
    const result = await engine.join(wallet);
    if (!result.ok) {
      res.status(409).json({ error: result.reason, code: result.code });
      return;
    }
    res.json({ ok: true, cards: result.cards, tokenAmount: result.tokenAmount });
  } catch (err) {
    console.error('[api] join failed:', err);
    res.status(502).json({ error: 'Could not verify your holdings. Try again in a moment.' });
  }
});

app.get('/api/winners', async (_req, res) => {
  res.json(await recentWinners(20));
});

app.get('/api/leaderboard', async (_req, res) => {
  res.json(await leaderboard(20));
});

// ---------------------------------------------------------------------------
// WebSocket — the room. Server pushes every phase change and every ball.
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

function broadcast(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

wss.on('connection', (ws: Client) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Hand the newcomer the full picture immediately.
  send(ws, 'config', publicConfig());
  send(ws, 'state', engine.getState());

  ws.on('message', (raw) => {
    let msg: { type?: string; wallet?: string };
    try {
      msg = JSON.parse(String(raw)) as { type?: string; wallet?: string };
    } catch {
      return;
    }
    if (msg.type === 'ping') send(ws, 'pong', { t: Date.now() });
    if (msg.type === 'sync') send(ws, 'state', engine.getState());
  });
});

// Drop dead sockets so the client count stays honest.
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

engine.on('state', ({ reason, state }: { reason: string; state: unknown }) => {
  broadcast('state', state);
  if (reason === 'settled') broadcast('settled', state);
});

engine.on('ball', (payload: unknown) => {
  broadcast('ball', payload);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

server.listen(config.port, () => {
  console.log(`[server] listening on :${config.port}`);
  console.log(`[server] mint ${config.tokenMint}`);
  console.log(
    `[server] ${config.tokensPerCard.toLocaleString()} $${config.tokenSymbol} = 1 card · ` +
      `pattern ${config.winPattern} · jackpot 1-in-${config.jackpotOdds}`,
  );
  void engine.start();
});

function shutdown(signal: string): void {
  console.log(`[server] ${signal} received, shutting down`);
  engine.stop();
  clearInterval(heartbeat);
  for (const client of wss.clients) client.close(1001, 'server shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
