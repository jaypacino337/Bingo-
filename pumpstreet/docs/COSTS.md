# Pump Street — Mint Costs & Raise Model

**SOL reference price: $75.60** (checked 2026-08-15). Every dollar figure below
moves with SOL — re-check before committing to a mint price.

> All on-chain cost figures are **estimates from public rent/fee schedules and
> must be verified on devnet before mainnet.** Deploy the exact program and
> candy machine to devnet, measure real lamport deltas, and replace this table.
> Do not take these numbers to a launch date unverified.

---

## 1. The headline

| Question | Answer |
|---|---|
| **What it costs *you* to launch** | **~4.5–7 SOL ≈ $340–530**, one-off |
| **What a minter pays** | **0.15 SOL ≈ $11.34** (recommended) |
| **What you raise if Phase 1 clears** | **300 SOL ≈ $22,680** |
| **Net after launch costs** | **~$22,150** |

**The mint is not the expensive part. The program deploy is.** Because Metaplex
Core mints on demand, the *buyer* pays the ~0.0029 SOL of account rent for their
own NFT. Your per-NFT cost is effectively zero. That's what makes the two-phase
plan work.

---

## 2. Your launch costs, itemised

| Item | Est. SOL | Est. USD | Notes |
|---|---:|---:|---|
| Anchor program deploy (staking/economy) | 2.5–3.5 | $190–265 | Biggest line. Scales with binary size. **Recoverable** — closing the program refunds rent. |
| Program upgrade buffer (×2 redeploys) | 0.6 | $45 | Budget for fixing things post-launch |
| Candy Machine account (2,000 config lines) | 0.5–0.7 | $38–53 | ~40 bytes/item at ~7 SOL/MB rent |
| Collection asset + metadata | 0.01 | $0.76 | One Core collection NFT |
| Reward-vault + config PDAs | 0.02 | $1.50 | Small accounts |
| Metadata/image hosting (Arweave via Irys) | ~0.15 | ~$11 | 2,000 × ~200KB ≈ 400MB. IPFS pinning is cheaper still |
| Priority fees / retries during mint | 0.2–0.5 | $15–38 | Congestion insurance |
| $PUMPST launch on pump.fun | ~0.02 | $1.50 | Excludes the dev buy |
| **Total (excl. dev buy & art)** | **~4.0–5.5** | **~$300–415** | |
| Contingency (+30%) | | **~$390–540** | Use this number |

**Excluded on your instruction:** the 10k art generation. See §5 for the
two-part plan that keeps it cheap.

**Excluded because it's a capital allocation, not a cost:** the pump.fun dev buy.
That's money you keep (as tokens), not money you spend.

---

## 3. Why 10,000 @ 0.035 SOL is the wrong shape

Your original numbers were built for a ~$200 SOL. At **$75.60**, they break:

| | 10k @ 0.035 | 2k @ 0.15 |
|---|---|---|
| Price per NFT | **$2.65** | **$11.34** |
| Buyers needed to clear | **10,000** | **2,000** |
| Gross if sold out | 350 SOL / $26,460 | 300 SOL / $22,680 |
| Gross at a realistic 40% sell-through | 140 SOL / **$10,584** | 120 SOL / **$9,072** |
| First-1,000 bootstrap | 35 SOL / **$2,646** | 150 SOL / **$11,340** |

Three problems with the cheap-and-wide version:

1. **$2.65 is a free-mint price.** It selects for bots and instant flippers, not
   people who will stake a plot and play an economy for months. Your entire
   design depends on committed holders — §10 of the economy doc shows weight
   competition breaking below ~65% staked.
2. **You need 10,000 buyers.** For an unknown project that is a very hard number.
   2,000 is achievable.
3. **Your own bootstrap plan doesn't fund itself.** First 1,000 mints at 0.035
   raises **$2,646** — that does not cover art, audit, and Phase 2. At 0.15 it
   raises **$11,340**, which genuinely does.

**Recommendation: 2,000 plots @ 0.15 SOL.** Same gross as the 10k plan, one
fifth the buyers, five times the bootstrap capital, and a holder base that
actually shows up.

---

## 4. Hitting your $20k target — the options

Every row grosses roughly the same. The only variable that matters is **how many
buyers you need to find.**

| Supply | Price | Gross SOL | Gross USD | Buyers needed | Verdict |
|---:|---:|---:|---:|---:|---|
| 10,000 | 0.035 | 350 | $26,460 | 10,000 | ❌ Unrealistic |
| 5,000 | 0.070 | 350 | $26,460 | 5,000 | ❌ Still very hard |
| 3,000 | 0.100 | 300 | $22,680 | 3,000 | ⚠️ Ambitious |
| **2,000** | **0.150** | **300** | **$22,680** | **2,000** | ✅ **Recommended** |
| 1,500 | 0.200 | 300 | $22,680 | 1,500 | ✅ Safest |
| 1,000 | 0.300 | 300 | $22,680 | 1,000 | ⚠️ Price may deter |

**Break-even is trivially low.** At 0.15 SOL you cover all launch costs after
**~37 mints**. Everything past that is raise.

**Partial sell-through, at 0.15 SOL:**

| Sold | SOL | USD |
|---:|---:|---:|
| 500 (25%) | 75 | $5,670 |
| 1,000 (50%) | 150 | $11,340 |
| 1,400 (70%) | 210 | $15,876 |
| 2,000 (100%) | 300 | **$22,680** |

To clear $20k you need **~1,765 mints (88%)**. If that feels optimistic, go
**1,500 @ 0.20** — same gross, and you only need 1,320 buyers to hit $20k.

---

## 5. The two-part plan (your "cheap generation" idea, made concrete)

You were right that this should be split. Here's the version that works.

### Phase 1 — Genesis Block: 2,000 plots @ 0.15 SOL

- **Art:** generate **2,000** only. Not 10,000. Layered generative art at this
  size is a weekend of work or a few hundred dollars commissioned.
- **Cost exposure before revenue: ~$400–540 + art.**
- **Revenue at sell-out: $22,680.**
- Candy Machine sized to exactly 2,000 config lines — you are not paying rent
  for 8,000 slots that may never mint.

### Phase 2 — Expansion: 3,000 plots @ 0.22 SOL *(only if Phase 1 clears)*

- **Hard gate: do not deploy Phase 2 unless Phase 1 sells ≥ 85%.** Adding supply
  to a street that didn't fill dilutes your existing holders and is the single
  most common way these projects lose their community.
- Funded entirely by Phase 1 revenue. Zero out-of-pocket.
- Priced **higher**, not lower — Phase 1 holders must never watch newcomers get
  in cheaper. That's the difference between a rewarded early holder and a
  punished one.
- Gross at sell-out: 660 SOL ≈ **$49,896**.
- New districts open (Warehouse Row / Outskirts expansion), so Phase 2 land is
  *different*, not just *more*.

### Combined ceiling
**5,000 plots · 960 SOL ≈ $72,576** — with only Phase 1's ~$500 ever at risk.

---

## 6. Ongoing revenue after mint

The mint is one-off. These are not:

| Source | Rate | At 1,400 active plots |
|---|---|---|
| Upgrade SOL fees | 0.002–0.03 per upgrade | ~15–25 SOL/mo |
| Rezoning permits | 0.05 SOL | ~2–5 SOL/mo |
| Secondary royalties | 5% enforced via Core | scales with volume |
| pump.fun creator fees | 0.05% of all $PUMPST trades | scales with volume |

Creator fees are the one that matters long-term — they accrue on **every**
$PUMPST trade forever, and they're the natural funding source for the
buyback-and-burn that closes the burn-ratio gap in ECONOMY.md §10.

---

## 7. Cost drivers to watch

- **Program size is your main lever.** Every 100KB of compiled binary is roughly
  0.7 SOL of rent. Keep the program lean; put presentation logic off-chain.
- **Program rent is recoverable.** Closing a buffer or program refunds the rent
  to your authority. Budget it as a deposit, not a burn.
- **Don't pre-mint.** On-demand minting via Candy Machine pushes per-asset rent
  to the buyer. Pre-minting 2,000 assets yourself would cost ~6 SOL you don't
  need to spend.
- **cNFTs are ~100× cheaper but wrong here.** Compressed NFTs would cut asset
  rent to near zero, but they have weaker marketplace/wallet support and are
  awkward to use as collateral in a staking program. At 2,000 supply the saving
  is ~5 SOL — not worth the friction. Core is the right call.

---

## 8. What must be verified before you commit

1. Deploy the Anchor program to **devnet**, measure actual deploy cost.
2. Deploy a 2,000-line Candy Machine to devnet, measure actual rent.
3. Confirm the current Metaplex Core protocol fee per mint.
4. Re-check the SOL price — every number here scales with it.
5. Confirm pump.fun's current creator-fee terms before relying on §6.
