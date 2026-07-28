# Bingo.fun — Everyone fights. One walks out.

A **duel royale**, run live on-chain. Hold the token and your wallet fields
fighters. Waves of elimination cut the arena down to eight, the last eight go
head to head, and the survivor takes the pot. Funded by pump.fun creator fees
and split **80% to the champion / 20% into a progressive jackpot** — and every
champion then rolls a **1-in-25** shot at that jackpot.

A round lasts about 30 seconds whether 8 fighters enter or 1,000: the culling
halves the field each wave, so the number of steps grows logarithmically.

```
┌──────────────┐        ┌───────────────────┐        ┌──────────────┐
│   Vercel     │  HTTP  │      Railway      │  SQL   │   Supabase   │
│  Next.js UI  │◄──────►│   game engine     │◄──────►│   history    │
│  (this repo  │   WS   │  (./server)       │        │   + jackpot  │
│   root)      │        │                   │        │              │
└──────────────┘        └─────────┬─────────┘        └──────────────┘
                                  │ RPC
                          ┌───────▼────────┐
                          │  Solana / RPC  │
                          │ holder balances│
                          └────────────────┘
```

| Piece | Lives in | Deploys to |
| --- | --- | --- |
| Website + game hall | repo root (`app/`, `components/`, `lib/`) | Vercel |
| Game engine, WebSocket, payouts | `server/` | Railway |
| Rounds, winners, jackpot | `supabase/schema.sql` | Supabase |

---

## How the game works

- **1,000,000 tokens = 1 fighter.** A wallet's balance is read when it enters;
  every whole 1M puts another fighter in the arena, capped by the max-wallet
  rule (5% of supply = 50 fighters by default).
- **Every fighter is equal.** Ten fighters is ten shots at winning, not a
  better shot. A wallet with one fighter can take down a whale in the final.
  Win probability is exactly proportional to entries — verified by simulation.
- **Provably fair.** Each round generates a secret `serverSeed` and publishes
  its SHA-256 hash when the lobby opens. The seed is revealed on settlement,
  and the entire round — every elimination and every duel — can be recomputed
  from it:

  ```js
  import { resolveRoyale } from './lib/royale';
  resolveRoyale(revealedSeed, fighters); // === exactly what played out
  ```

  Nothing is decided while the round is running. The seed shuffles the fighters
  into a secret ranking; waves cut from the bottom of it and duels are resolved
  by "better rank wins", so there is no moment where the server could nudge the
  outcome. The jackpot roll is derived the same way, from
  `sha256("jackpot:" + seed + ":" + wallet + ":" + entry) % 25`.

  `lib/royale.ts` and `server/src/royale.ts` are byte-for-byte identical —
  **if you edit one, copy it across** (`cp server/src/royale.ts lib/royale.ts`).

### Round loop

```
lobby (30s, join window)  →  fighters enter (3s)  →  culling waves (1.8s each)
      ↑                                                        │
      │                                                        ▼
      └────  champion (12s)  ←  duels (3.5s each)  ←  final eight
```

Each wave halves the field until eight remain, then the bracket runs
quarter-finals → semis → final. A lobby with fewer than two players recycles —
no pot is burned and nothing is written to the database.

---

## Deploy

Do these in order. Supabase first, because Railway wants its keys.

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](supabase/schema.sql),
   and hit **Run**. It is safe to re-run.
3. Go to **Project Settings → API** and copy:
   - the **Project URL** → `SUPABASE_URL`
   - the **`service_role`** key → `SUPABASE_SERVICE_ROLE_KEY`

> The service role key bypasses row-level security. It belongs on the Railway
> server only — never in the Vercel project, never in the browser.

Supabase is optional: without it the game still runs, but round history and the
jackpot balance reset on every restart.

### 2. Railway (game server)

1. **New Project → Deploy from GitHub repo** → pick this repo.
2. **Settings → Root Directory: `server`.** This is the one setting that
   matters — without it Railway will try to build the website instead.
   Build and start commands come from `server/railway.json` automatically.
3. **Variables →** paste from [`server/.env.example`](server/.env.example). The
   ones you must set:

   | Variable | What it is |
   | --- | --- |
   | `TOKEN_MINT` | your pump.fun mint address (the CA) |
   | `TREASURY_WALLET` | wallet you claim creator fees into |
   | `SOLANA_RPC_URL` | a real RPC — Helius, QuickNode, Triton |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `TOKENS_PER_CARD` | `1000000` (tokens per fighter) |
   | `MIN_TOKENS_TO_PLAY` | `1000000` |

4. **Settings → Networking → Generate Domain.** Copy that URL — Vercel needs it.
5. Check `https://your-app.up.railway.app/health` returns `{"ok":true,...}`.

> **Do not use the public `api.mainnet-beta.solana.com` RPC in production.** It
> is rate limited and holder lookups will start failing as soon as you have
> real players.

### 3. Vercel (website)

> **Root Directory must be EMPTY on Vercel.** It is the opposite of Railway,
> and getting them backwards is the single easiest way to break this deploy:
>
> | Platform | Root Directory |
> | --- | --- |
> | Railway | `server` |
> | Vercel | *(leave blank — repo root)* |

1. **Add New → Project →** import this repo.
2. Leave every build setting alone. Next.js is at the repo root, so Vercel
   detects it with no configuration.
3. **Environment Variables →** paste from [`.env.example`](.env.example). At
   minimum:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_GAME_URL` | your Railway URL, no trailing slash |
   | `NEXT_PUBLIC_TOKEN_MINT` | your CA |
   | `NEXT_PUBLIC_TOKEN_SYMBOL` | `BINGO` |
   | `NEXT_PUBLIC_TOKENS_PER_CARD` | `1000000` |

4. Deploy.

### 4. Lock it down

Back in Railway, set `CORS_ORIGINS` to your actual domain(s) instead of `*`:

```
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 5. Add the caller

Drop the caller's avatar at `public/host.png` (square PNG) and redeploy. See
[`public/README.md`](public/README.md). Until then it falls back to a
placeholder.

---

## The pot

`POT_SOURCE=creator_fees` (the default) sizes each round from the treasury:

```
available = treasury balance − TREASURY_RESERVE_SOL − current jackpot
pot       = clamp(available × POT_PAYOUT_RATIO, MIN_ROUND_POT_SOL, MAX_ROUND_POT_SOL)
prize     = pot × 0.8      →  the winner
jackpot  += pot × 0.2      →  the progressive
```

Because it takes a *percentage* of the float, the pot grows with volume and
never drains to zero. The jackpot is subtracted before sizing, so money already
owed to players is never recycled into a round.

Claim your pump.fun creator fees into `TREASURY_WALLET` and the pots follow
automatically. Set `POT_SOURCE=fixed` with `ROUND_POT_SOL` while testing.

### Paying winners

**Payouts are off by default.** Every win is written to Supabase with
`payout_status='pending'` and you settle from the treasury yourself:

```sql
select wallet, prize_lamports + jackpot_lamports as owed, round_id, created_at
from winners
where payout_status = 'pending'
order by created_at;
```

To let the server pay automatically, set `AUTO_PAYOUT=true` and
`PAYOUT_SECRET_KEY` to the treasury's base58 secret key. That means a live
server process holding a key that can move funds — only do it once you have
weighed that, and keep the treasury topped up with just what rounds need
rather than the whole supply.

---

## Local development

You need two terminals. No RPC key or real tokens required.

```bash
# terminal 1 — game server
cd server
npm install
cp .env.example .env        # set TOKEN_MINT to anything, and:
                            #   DEV_FAKE_HOLDERS=true
                            #   POT_SOURCE=fixed
npm run dev                 # :8080

# terminal 2 — website
npm install
npm run dev                 # :3000
```

`DEV_FAKE_HOLDERS=true` skips the chain entirely and hands every valid-looking
address a deterministic 1-8 cards, so you can play whole rounds offline.
**It must never be set on a live deployment** — it would let anyone in.

Speed a round up while testing:

```
LOBBY_MS=5000
BALL_INTERVAL_MS=400
```

---

## Configuration reference

Full lists with comments live in [`server/.env.example`](server/.env.example)
and [`.env.example`](.env.example). The knobs you are most likely to touch:

| Variable | Default | Effect |
| --- | --- | --- |
| `TOKENS_PER_CARD` | `1000000` | tokens per card |
| `MIN_TOKENS_TO_PLAY` | `1000000` | floor to enter |
| `MAX_WALLET_PERCENT` | `5` | max holding, sets the card cap (50 at 1B supply) |
| `MAX_CARDS_PER_WALLET` | `0` | override the derived cap (`-1` = uncapped) |
| `WAVE_MS` | `1800` | pause between culling waves |
| `DUEL_MS` | `3500` | time on screen per duel |
| `INTRO_MS` | `4000` | "fighters entering" beat |
| `LOBBY_MS` | `30000` | join window |
| `PRIZE_SHARE` / `JACKPOT_SHARE` | `0.8` / `0.2` | pot split (must sum to 1) |
| `JACKPOT_ODDS` | `25` | 1-in-N jackpot roll |
| `POT_PAYOUT_RATIO` | `0.1` | share of treasury float per round |

---

## API

The frontend only needs `NEXT_PUBLIC_GAME_URL`; everything else is derived.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | liveness + whether Supabase and payouts are wired |
| `GET /api/config` | public config (token, timings, odds) |
| `GET /api/state` | full round state |
| `GET /api/holder/:wallet` | balance and card count for a wallet |
| `POST /api/join` | take a seat (lobby phase only) |
| `GET /api/winners` | recent winners |
| `GET /api/leaderboard` | top wallets by winnings |
| `WS /ws` | live `state` and `ball` pushes |

The browser prefers the WebSocket and falls back to polling `/api/state` if the
socket cannot be established, so a cold container or a hostile network degrades
gracefully instead of showing a blank room.

---

## Troubleshooting the deploy

**"Deployment not found" / "no production deployment to redeploy" (Vercel)**

Vercel's *Production Branch* is set to a branch it has never built, so the
production domain has nothing attached to it. Fix:

1. **Settings → Git → Production Branch** — set it to the branch you actually
   push to, then **Save**.
2. Push any commit to that branch. The first build against it becomes the
   production deployment and the domain starts working.

The root cause is usually that the repo's default branch at import time was not
the branch you kept working on. Setting the GitHub default branch (**Settings →
General → Default branch**) to `main` before importing avoids it entirely.

**Build fails immediately on Vercel with "next: not found" or similar**

Root Directory is pointing at `server`. Clear it — see the table above.

**Repo shows "no commits found" / pull requests cannot be created**

The repo has only one branch, so there is no base to merge into and no `main`
to display. Create `main` and set it as the default branch.

**The arena says "Connecting…" forever**

`NEXT_PUBLIC_GAME_URL` is missing, wrong, or the Railway service is down. Check
`https://<your-railway-url>/health` returns `{"ok":true,...}`, and that the
value in Vercel has **no trailing slash**. Also confirm `CORS_ORIGINS` on
Railway includes your Vercel domain.

## Notes and limits

- **Joining is open to any address.** A player is admitted on token balance
  alone — there is no signature challenge, so anyone can seat a wallet they do
  not control. That is harmless while payouts go to the wallet address itself
  (the rightful owner receives the funds either way), but add wallet-signature
  auth before you attach anything that isn't a payout to the same address.
- **The balance snapshot is taken at join, not at settle.** Someone can enter
  and then sell; they keep their fighters for that round.
- **The arena renders at most 600 fighter tiles.** Beyond that it shows a count
  of what isn't drawn, rather than locking up the tab. Your own fighters are
  always drawn first, so you can find yourself in any size of crowd.
- Round history and the jackpot only persist with Supabase configured.
