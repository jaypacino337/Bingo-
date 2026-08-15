# Pump Street

> Own a plot. Pick how you use it. The street pays a fixed budget every day and
> you compete for a share of it.

A property-and-business economy on Solana, in the lineage of **SolSteads** (2021 —
minted at 0.25 SOL, floor peaked above 46 SOL). SolSteads had the right primitive
and no economy underneath it. This is the economy.

## What's here

| Path | What it is | Status |
|---|---|---|
| `docs/ECONOMY.md` | Full economic design — paths, sectors, sinks, emissions | ✅ Complete |
| `docs/COSTS.md` | Launch cost breakdown + raise model at live SOL price | ✅ Complete |
| `lib/` | Reference implementation of the whole economy, in TypeScript | ✅ 20 tests passing |
| `lib/simulate.ts` | Balance simulation — the thing that catches broken economies | ✅ Complete |
| `program/` | Anchor program mirroring the reference implementation | ⚠️ Draft, unaudited |
| `../app/street/` | Interactive UI — configure a plot, see it settle | ✅ Complete |
| Art generation (2,000 plots) | Deliberately out of scope — see COSTS.md §5 | ⛔ Not started |

## The one idea

Most NFT-staking economies promise **fixed yield per NFT**. That makes emissions a
function of how many NFTs are staked — which the team can't control — so supply
grows without bound and the yield becomes worthless.

Pump Street emits a **fixed daily budget**. Your payout is your *share*:

```
your_daily_PUMPST = DAILY_EMISSION × (your_weight / total_street_weight)
```

Upgrading raises your slice. It never raises the pie. Everything else follows
from that.

## The three paths

- **Residential** — rent to tenants. Low variance, no market exposure. A crash
  doesn't touch you.
- **Commercial** — lease to a business. Locked term, dampened swings, tenant can
  default.
- **Enterprise** — run it yourself. Pick a sector, take a LONG/SHORT position,
  full exposure. Can go into debt.

Enterprise sectors read **real Pyth price feeds**. Go long on the Hedge Fund and
SOL drops 6% overnight, and you earn near-nothing that day. Short it and you'd
have printed.

## Run it

```bash
npm install
npm test            # 20 tests, including the emission invariant
npm run dev         # UI at /street
npm run typecheck
```

To re-run the balance simulation after changing any tunable in
`lib/constants.ts`:

```ts
import { runSimulation, DEFAULT_SIM } from './lib/simulate';
console.log(runSimulation({ ...DEFAULT_SIM, days: 180 }));
```

## What the simulation caught

These are real defects the sim found before launch, not hypotheticals:

1. **Tier caps created a sink cliff.** Once players hit the max tier their lot
   allows, upgrades stop and the burn ratio collapsed to **0.20**. Fixed with a
   property tax taken as a share of yield (never a flat fee, so it can't bankrupt
   anyone). Burns went 0.20 → 0.45.
2. **Exponential tier weights are oligarchic.** The original curve produced a
   payout Gini of 0.71. Compressed the curve.
3. **Cheap upgrades ≠ fast progression.** Halving costs moved median-days-to-tier-3
   from 65 → 28, then tax drag put it back to ~55.

Two targets are still missed (burn ratio 0.52 vs 0.70, Gini 0.71 vs 0.55). Both
are documented honestly in `docs/ECONOMY.md §10` with the tradeoffs — they're
product calls, not bugs.

## Before mainnet

- [ ] Audit the Anchor program. It is an unaudited draft.
- [ ] Verify deploy + Candy Machine costs on devnet (`docs/COSTS.md §8`)
- [ ] Decide on the directional-sector regulatory question (`ECONOMY.md §11`)
- [ ] Publish the collection seed so land rarity is verifiable pre-mint
- [ ] Publish the dev-buy wallet and vesting before the token launches

## Honest limitations

- The program is a **reference draft**. It compiles conceptually against Anchor
  but has not been built, tested on devnet, or audited.
- Settlement is **two-phase** (accumulate weights, then pay out) because total
  weight must be known before any share can be computed. The crank is off-chain.
- **Season 1 is inflationary by construction.** No tuning fixes that; the
  treasury has to carry it.
- Nothing here promises a return, and the UI is written to avoid implying one.
