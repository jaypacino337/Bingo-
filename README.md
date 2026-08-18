# Cash Cow — Hold the cow. Get paid.

A memecoin site with one job: on a timer, snapshot every holder on chain and
split the pump.fun creator fees between them, weighted by holding. Nothing to
claim, nothing to connect, no button to press.

```
┌──────────────┐        ┌───────────────────┐        ┌──────────────┐
│   Vercel     │  HTTP  │      Railway      │  SQL   │   Supabase   │
│  the website │◄──────►│  airdrop engine   │◄──────►│ drop receipts│
│  (repo root) │   WS   │    (./server)     │        │              │
└──────────────┘        └─────────┬─────────┘        └──────────────┘
                                  │ RPC
                          ┌───────▼────────┐
                          │  Solana / RPC  │
                          │ holders + sends│
                          └────────────────┘
```

| Piece | Lives in | Deploys to |
| --- | --- | --- |
| Website | repo root (`app/`, `components/`, `lib/`) | Vercel |
| Airdrop engine | `server/` | Railway |
| Drop receipts | `supabase/schema.sql` | Supabase |

---

## Read this before you launch

Three things are true and worth being clear-eyed about.

**1. Fee claiming is not automated, and can't honestly be.** pump.fun creator
fees are claimed by the coin's creator through pump.fun, under their authority.
This server does not hold that authority and does not pretend to. The boundary
is: **you claim fees into `TREASURY_WALLET`** — from the pump.fun UI, or on
whatever schedule you like — and the engine shares out whatever it finds there.
It never invents a balance. If nothing has been claimed, the pot is empty and
the drop is skipped.

**2. Sending is off by default and has never been exercised.** With
`AUTO_PAYOUT=false` the engine does everything except send: it snapshots,
allocates, and records the drop as a dry run. The allocation maths is tested
(see below). The transaction-sending path is written but has not been run
against a real cluster. **Test on devnet before you point it at mainnet.**

**3. Every 5 minutes is aggressive.** Each drop scans every token account for
your mint and sends a batch of transactions. With a few hundred holders that is
~15-30 transactions per drop, ~8,600 per day, plus the RPC load of the scan.
The floor at `AIRDROP_MIN_POOL_LAMPORTS` stops you paying more in fees than you
hand out, but if drops keep being skipped, lengthen the interval rather than
lowering the floor.

---

## How a drop works

```
every AIRDROP_INTERVAL_MS
  │
  ├─ read TREASURY_WALLET balance
  ├─ pool = (balance − TREASURY_RESERVE_SOL) × AIRDROP_PAYOUT_RATIO
  ├─ if pool < AIRDROP_MIN_POOL_LAMPORTS → skip, roll over
  │
  ├─ snapshot: scan every token account for the mint, fold by owner
  │    ├─ drop anything under AIRDROP_MIN_TOKENS
  │    └─ drop EXCLUDE_WALLETS + the treasury itself
  │
  ├─ allocate: share = pool × (your balance ÷ total eligible)
  │    └─ skip allocations under AIRDROP_MIN_LAMPORTS (dust)
  │
  ├─ send in batches of 18 transfers per transaction
  └─ write the drop + one receipt row per holder to Supabase
```

Rounding remainders and everything below the dust floor stay in the treasury
and roll into the next drop. Nothing is lost.

### What's actually verified

The allocation maths is the part that moves money, so it is tested directly:
across 3,000 randomised holder distributions it **never overspends the pool**,
always balances (`sum(allocations) + dust == pool`) and never emits an
allocation below the dust floor. Worst-case retained dust was 0.25% of a pool.
Splits are computed in `bigint` so a 1,000,000,000 supply cannot lose precision.

The full cycle — snapshot, allocate, record, feed the site — has been run end
to end against the dev stub. The on-chain send has not.

---

## Deploy

Supabase first, because Railway wants its keys.

### 1. Supabase

**SQL Editor** → paste all of [`supabase/schema.sql`](supabase/schema.sql) →
**Run**. Then **Settings → API** and copy the **Project URL** and the
**`service_role`** key.

> The service role key belongs on Railway only. Never in Vercel, never in the
> browser.

### 2. Railway (the engine)

1. **New Project → Deploy from GitHub repo** → this repo.
2. **Settings → Root Directory: `server`.** Without it Railway builds the
   website instead and nothing works.
3. **Variables →** paste [`server/.env.example`](server/.env.example) and fill
   in `TOKEN_MINT`, `TREASURY_WALLET`, `SOLANA_RPC_URL`, and the Supabase keys.
4. **Settings → Networking → Generate Domain.** Copy the URL.
5. Open that URL — it should identify itself as the airdrop server. `/health`
   should return `{"ok":true,...}`.

> **A paid RPC is not optional here.** A holder snapshot uses
> `getProgramAccounts`, which the public endpoint refuses. Helius, QuickNode or
> Triton.

### 3. Vercel (the site)

1. **Add New → Project →** import this repo.
2. **Root Directory must be EMPTY** — the opposite of Railway.
3. **Environment Variables →** [`.env.example`](.env.example). At minimum
   `NEXT_PUBLIC_GAME_URL` (your Railway URL, https, no trailing slash).
4. Deploy.

### 4. Lock down

```
CORS_ORIGINS=https://yourdomain.com
ADMIN_TOKEN=something-long-and-random
```

`ADMIN_TOKEN` guards `POST /api/drop`, which fires a drop by hand. Without it
that endpoint is open to anyone.

---

## Turning on real payouts

Do this in order.

1. **Devnet first.** Point `SOLANA_RPC_URL` at devnet, use a devnet mint and a
   throwaway treasury, set `AUTO_PAYOUT=true`, and watch a few drops land.
2. **Fund thin.** Keep only what the next few drops need in the treasury. This
   server holds a key that can spend all of it.
3. **Exclude what isn't a holder.** Put the bonding curve, LP pools and any
   team wallets in `EXCLUDE_WALLETS` before the first live drop. Paying those
   burns the pool on accounts that aren't people.
4. Then set `AUTO_PAYOUT=true` and `PAYOUT_SECRET_KEY` on mainnet.

Watch the first live drop in the Railway logs. A failed batch is logged and its
holders are recorded with `status='failed'` — the rest of the drop still goes
through.

```sql
-- anything that failed and may need re-sending
select d.created_at, p.wallet, p.lamports
from payouts p join drops d on d.id = p.drop_id
where p.status = 'failed' order by d.created_at desc;
```

---

## Local development

No RPC key or real token needed.

```bash
# terminal 1 — engine
cd server && npm install
cp .env.example .env       # set TOKEN_MINT and TREASURY_WALLET to anything valid, plus:
                           #   DEV_FAKE_HOLDERS=true
npm run dev                # :8080

# terminal 2 — site
npm install && npm run dev # :3000
```

`DEV_FAKE_HOLDERS=true` invents a treasury balance that drifts upward and a
120-holder list with a realistic long tail, so the countdown, pot, feed and
wallet lookup all behave. **Never set it on a live deployment** — the numbers on
screen would be fiction.

Force a drop without waiting:

```bash
curl -X POST localhost:8080/api/drop
```

---

## Configuration

Full lists with comments are in [`server/.env.example`](server/.env.example)
and [`.env.example`](.env.example). The ones that matter:

| Variable | Default | Effect |
| --- | --- | --- |
| `AIRDROP_INTERVAL_MS` | `300000` | how often a drop runs (5 min) |
| `AIRDROP_PAYOUT_RATIO` | `1` | share of the unreserved balance handed out |
| `TREASURY_RESERVE_SOL` | `0.05` | never spend below this |
| `AIRDROP_MIN_POOL_LAMPORTS` | `10000000` | skip drops smaller than 0.01 SOL |
| `AIRDROP_MIN_TOKENS` | `1` | minimum holding to be in the snapshot |
| `AIRDROP_MIN_LAMPORTS` | `5000` | dust floor per holder |
| `EXCLUDE_WALLETS` | *(empty)* | LP, bonding curve, team wallets |
| `AUTO_PAYOUT` | `false` | actually send |

`NEXT_PUBLIC_DROP_MINUTES` on Vercel must match `AIRDROP_INTERVAL_MS`, or the
site advertises an interval it doesn't run on.

---

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | liveness, whether sending is on |
| `GET /api/config` | public config |
| `GET /api/state` | countdown, pot, holder count, recent drops |
| `GET /api/holder/:wallet` | holding, share %, next drop, earned to date |
| `GET /api/drops` | drop history |
| `POST /api/drop` | fire a drop now (needs `ADMIN_TOKEN` when set) |
| `WS /ws` | live state pushes |

The browser prefers the WebSocket and falls back to polling, so a cold Railway
container degrades to a slower page rather than a broken one.

---

## Notes

- Nothing technical is ever shown to visitors. Missing config, a dead server or
  a runtime error all render as ordinary copy; details go to the browser console.
- The site is a single static page. There is no server-side rendering to fail.
- Drops depend entirely on fees actually being claimed into the treasury. No
  volume, no fees, no drop — the site says so rather than inventing a number.
- **Not affiliated with any payment app, bank or exchange.** The branding here
  is an original cow, and should stay that way.
