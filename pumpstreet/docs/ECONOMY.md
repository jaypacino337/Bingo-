# Pump Street — Economic Design

> A gamified property economy on Solana. You own a plot. You pick how to use it.
> The street pays out a fixed budget every day, and you compete for share of it.

**Status:** design spec + reference implementation (`pumpstreet/lib`). Numbers are
tunable constants, not promises. Nothing here is a projection of financial return.

---

## 0. The one decision that matters

Most NFT-staking economies die the same way: they promise **fixed yield per NFT**
(“earn 10 $TOKEN per day”). That makes emissions a function of how many NFTs are
staked, which the team cannot control, so supply grows without bound, price falls,
and the yield becomes worthless. Upgrades make it worse — every upgrade prints more.

Pump Street inverts this.

> **The street emits a fixed budget per day. You earn a *share* of it, proportional
> to your plot's weight against the total weight of every staked plot.**

```
your_daily_PUMPST = DAILY_EMISSION × (your_weight / total_street_weight)
```

Consequences, all of them intentional:

- **Emissions are bounded and knowable years out.** Inflation is a schedule, not an outcome.
- **Upgrading is competitive, not additive.** Upgrading raises your slice; it never
  raises the pie. If everyone upgrades, nobody gains — which is exactly the pressure
  that makes upgrade decisions interesting instead of automatic.
- **Late joiners aren't locked out.** They dilute existing holders rather than being
  handed a worse fixed rate.
- **The team can never be forced into a death spiral by their own success.**

This single change is what separates a game economy from a yield trap. Everything
below is built on it.

---

## 1. Reference: what we're actually reviving

The inspiration is **SolSteads** (Solana, 2021) — virtual property NFTs, minted at
**0.25 SOL**, floor above **46 SOL** at peak with regular 100 SOL sales. The lesson
worth taking is *not* "line went up." It's:

- **Property is a legible primitive.** Everyone instantly understands owning a house
  on a street. No tutorial required.
- **Address scarcity is real scarcity.** Plot #1 on the main block is permanently
  more desirable than #4,912 in the outskirts. That's built-in rarity that doesn't
  depend on art traits.
- **They had no economy.** SolSteads was a picture of a house. The floor was pure
  narrative, so it round-tripped. Pump Street's answer is a working economy with
  sinks — the thing that was missing.

---

## 2. The asset: a Plot

Each NFT is a **Plot** with immutable land attributes and mutable building state.

### Immutable (set at mint, affects value forever)

| Attribute | Range | Effect |
|---|---|---|
| `plotNumber` | 1..N | Street address. Lower = more prestigious. |
| `district` | 6 districts | Base yield multiplier + which sectors are boosted |
| `lotSize` | 1–4 | Caps max building tier. A size-1 lot can never hold a tower. |
| `frontage` | 1–3 | Multiplier on Commercial path (foot traffic) |
| `cornerLot` | bool | +8% weight, unlocks a second business slot at Tier 4 |
| `landmark` | rare | ~1.5% of plots. Permanent +25% weight, cosmetic marker on map |

### Districts

| District | Share | Base mult | Favors | Character |
|---|---|---|---|---|
| **The Strip** | 8% | 1.35× | Enterprise | High traffic, high tax, volatile |
| **Old Town** | 14% | 1.15× | Commercial | Established, stable leases |
| **Riverside** | 18% | 1.10× | Residential | Desirable homes, low variance |
| **The Grid** | 30% | 1.00× | balanced | The default. Most plots live here. |
| **Warehouse Row** | 20% | 0.95× | Enterprise | Cheap land, industrial, boom/bust |
| **Outskirts** | 10% | 0.85× | Residential | Cheapest entry, upgrade-friendly tax |

Districts are **not** just multipliers — they change which path is correct for that
plot. That is what makes a cheap Outskirts plot a real strategic choice rather than
strictly worse than a Strip plot.

### Mutable (the game)

```ts
{
  path:        'RESIDENTIAL' | 'COMMERCIAL' | 'ENTERPRISE' | null,
  tier:        0..5,                // building level
  condition:   0..100,              // decays; low condition slashes weight
  sector:      Sector | null,       // ENTERPRISE only
  stance:      'LONG' | 'SHORT' | null,  // market-facing sectors only
  leaseEndsAt: timestamp | null,    // COMMERCIAL lock
  staked:      bool,
  cooldowns:   { upgrade, pathChange, stance }
}
```

---

## 3. The three paths

This is the core of the design and maps directly to a real risk ladder. You commit a
plot to one path; switching has a real cost and cooldown (§6).

### 3.1 RESIDENTIAL — rent to tenants
**Low risk, low variance, low ceiling.** The bond.

- Yield is near-deterministic: `base × tier × condition`, ±3% noise.
- No market exposure. A crash does not touch you.
- **Tenant Satisfaction** (0–100) drifts with your `condition`. Below 40, tenants
  start leaving and weight drops sharply.
- Best on Riverside / Outskirts.
- **Weight multiplier: 1.00×**, variance ±3%.

*Who this is for:* people who want to stake and forget, and the stabilising mass of
the economy. Roughly half the street should end up here, and that's healthy.

### 3.2 COMMERCIAL — lease to a business
**Medium risk, medium reward, illiquid.** The credit instrument.

- You lease to an NPC business for a fixed term (7 / 14 / 30 days).
- Longer term = higher multiplier, but your plot is **locked** — no path change, no
  unstake, no stance change until the lease ends.
- Your yield tracks the **sector index** of your tenant, but *dampened*: you get 35%
  of the sector's swing. You're the landlord, not the owner — you get rent even in a
  bad month, but you don't capture the upside of a boom.
- **Tenant quality** is rolled at lease signing (affected by `frontage`, district,
  tier). A bad tenant can default (~4%/term), costing you the remaining term.
- **Weight multiplier: 1.15× – 1.45×** by term length, variance ±12%.

*Who this is for:* players who want more than Residential but don't want to babysit a
position daily. The lock is the price of the premium.

### 3.3 ENTERPRISE — run your own business
**High risk, high reward, hands-on.** The leveraged equity position.

- You pick a **sector**. Your daily P&L is driven by that sector's index, which is in
  turn driven by **real market data** (§5) plus randomness.
- Some sectors are **directional**: you set a `stance` of LONG or SHORT. If the market
  moves against you, **you earn nothing that day** and may owe upkeep.
- **Enterprise can go negative.** Not "less rewards" — actual debt against future
  emissions, capped at 3 days of your average yield. This is the only path where
  that's possible, and it's what makes the ceiling justifiable.
- **Weight multiplier: 0.7× – 2.6×** depending on the day's outcome. Variance ±60%.

*Who this is for:* the degens. Should be ~20–25% of the street. They generate the
stories that market the project.

---

## 4. Sectors (Enterprise)

| Sector | Driver | Directional | Variance | Notes |
|---|---|---|---|---|
| **Hedge Fund** | SOL/USD 24h Δ (Pyth) | **Yes** | Extreme | Pick LONG/SHORT daily. Biggest swings in the game. |
| **Prop Desk** | BTC/USD 24h Δ (Pyth) | **Yes** | High | Slower, less noisy than Hedge Fund. |
| **Casino** | Pure VRF | No | Extreme | ~8% chance of a 6× day, otherwise poor. Pure gambling. |
| **Nightclub** | Weekend + network activity | No | High | Fri/Sat multiplier. Dead midweek. |
| **Tech Startup** | Slow burn + exit lottery | No | Extreme | Loses money most days. ~0.4%/day chance of a 40× "exit". |
| **Deli** | Inverse volatility | No | Low | Earns *more* when markets are calm. A genuine hedge. |
| **Gym** | Neighbor density | No | Medium | Scales with how many adjacent plots are staked and upgraded. |
| **Barbershop** | Steady + streak bonus | No | Low | Rewards uninterrupted staking. Streak resets on unstake. |

The **Deli** is deliberately anti-correlated. When SOL dumps and every Hedge Fund on
the street is underwater, delis print. This gives the economy an internal stabiliser
and gives players a real reason to diversify across multiple plots — which is the
cleanest possible driver of secondary-market demand.

**The user's exact scenario, implemented:** you run a Hedge Fund, you set stance LONG,
SOL drops 6% overnight → your `marketFactor` goes deeply negative → your weight
collapses to the 0.7× floor → you earn near-nothing that day, and if you were tier 4+
with high upkeep, you go into debt. Set SHORT on that same day and you'd have printed
2.6×. See `lib/market.ts` and `lib/yield.ts`.

---

## 5. Real-time market linkage

**On-chain source: Pyth price feeds on Solana** (SOL/USD, BTC/USD). Pyth is already on
Solana, updates sub-second, and exposes a confidence interval we use to reject bad ticks.

**Daily settlement, not continuous.** Each UTC day the program:

1. Reads the Pyth feed at settlement, compares to the stored open price.
2. Computes `delta = (close - open) / open` per feed.
3. Derives each sector's index from its driver.
4. Rolls per-plot randomness from a **VRF / recent-blockhash commit-reveal** so the
   settler cannot grind outcomes.
5. Computes every staked plot's weight and pays out that day's emission share.

Why daily and not continuous: it makes a single decision (your stance) matter, it's
cheap to settle, and it produces a clean daily narrative — "how did the street do
today" — which is the social hook.

**Anti-manipulation:**
- Stance changes have a **6-hour cooldown** and are locked in the 2 hours before
  settlement. You cannot see the candle and then flip.
- Price is a **TWAP over the final hour**, not a spot read, so a single wick can't
  decide the day.
- Pyth confidence interval above threshold → the day is voided at 1.0× for everyone
  rather than settled on bad data.

---

## 6. Upgrades, cooldowns, decay

### Tiers

| Tier | Name | PUMPST cost | SOL fee | Build time | Weight |
|---|---|---|---|---|---|
| 0 | Empty Lot | — | — | — | 0.5× |
| 1 | Shack | 1,000 | 0.002 | 2h | 1.0× |
| 2 | House | 4,500 | 0.004 | 8h | 1.6× |
| 3 | Building | 18,000 | 0.008 | 24h | 2.5× |
| 4 | Complex | 65,000 | 0.015 | 48h | 3.8× |
| 5 | Tower | 220,000 | 0.03 | 96h | 5.5× |

- **`lotSize` caps tier**: size 1 → max tier 2, size 2 → max 3, size 3 → max 4,
  size 4 → max 5. Only ~6% of plots can ever reach Tower. This is the scarcity that
  makes large lots trade at a premium forever.
- **Build time is a real cooldown.** The plot earns at the *old* tier while building.
- **PUMPST cost is burned.** Not sent to treasury. Burned.
- **SOL fee is protocol revenue** — this is a live business, not just mint income.

### Condition decay

`condition` drops **1.2/day** (faster at higher tiers: `1.2 + 0.3 × tier`). Below 60
weight starts scaling down; at 0 the plot earns nothing.

**Repair** costs PUMPST proportional to damage and tier. This is the primary,
never-ending sink — the one that keeps burning after everyone has finished upgrading.

*Why decay is non-negotiable:* without it, a fully-upgraded street becomes a permanent
fixed-yield machine and every argument from §0 comes back. Decay guarantees that
emissions are continuously matched by burns, indefinitely.

### Cooldowns

| Action | Cooldown | Bypass |
|---|---|---|
| Upgrade tier | build time | — (cannot be bypassed) |
| Change path | 7 days | 0.05 SOL "rezoning permit" |
| Change stance | 6h + locked 2h pre-settlement | none |
| Unstake | 24h "move out" | forfeits current day's accrual |
| Repair | none | — |

---

## 7. Random events

Rolled per-plot at settlement using VRF. Roughly 12% of plots get an event daily.

| Event | Chance | Effect |
|---|---|---|
| Block Party | 3.0% | +40% weight today, all plots on your block |
| Health Inspector | 2.0% | Enterprise only: −50% today unless condition > 80 |
| Burst Pipe | 2.0% | −15 condition immediately |
| Celebrity Sighting | 0.8% | +150% weight today |
| Rent Strike | 1.5% | Residential only: 0 yield today if condition < 50 |
| Viral Moment | 0.5% | +300% weight today, plot gets a permanent badge |
| Grand Opening | 1.2% | Enterprise: first 3 days after sector change get +25% |
| Permit Audit | 1.0% | Upgrade cooldown extended 12h |

Events are **weight modifiers**, not extra minting — a lucky event takes share from
everyone else that day. The pie is still fixed. This is what keeps §0 intact even
with heavy randomness.

---

## 8. The token: $PUMPST

### Launch
Launched on **pump.fun** (1B supply, ~800M on the bonding curve, migrates to PumpSwap
at full bond). The creator takes a **dev buy at launch** — the cheapest point on the
curve — which becomes the protocol's working capital.

**Dev buy allocation (recommendation):**

| Bucket | Share of dev buy | Purpose | Vesting |
|---|---|---|---|
| Rewards Treasury | 55% | Funds daily emissions | Locked, released on schedule |
| Liquidity Support | 20% | Paired into PumpSwap LP post-migration | Locked 6 months |
| Team | 15% | — | 6mo cliff, 18mo linear |
| Community / marketing | 10% | Contests, partner mints | Discretionary |

**Be honest about this:** a large dev buy *is* a large insider allocation. The only
thing that makes it acceptable is that it's disclosed, on-chain, and vested. Publish
the wallet before launch and let people verify. A hidden dev buy that gets discovered
is a project-ending event — see the CashCat work in this repo's history for what that
scrutiny looks like in practice.

### Emission schedule

Fixed daily budget with a halving-style decay:

| Period | Daily emission | Duration | Total |
|---|---|---|---|
| Season 1 | 400,000 | 90 days | 36.0M |
| Season 2 | 280,000 | 90 days | 25.2M |
| Season 3 | 196,000 | 90 days | 17.6M |
| Season 4+ | ×0.7 each season, floor 40,000/day | — | — |

Total emitted over the first year ≈ **92M PUMPST**. Against a 1B supply that's ~9.2%
annual inflation in year one, decaying hard. That is survivable. "10 tokens per NFT
per day" is not.

### Sinks (where PUMPST goes to die)

1. **Upgrades** — burned
2. **Repairs** — burned (the perpetual one)
3. **Rezoning permits** — burned
4. **Business licenses** — burned, required per sector change
5. **Insurance premiums** — burned, optionally caps Enterprise downside
6. **Vanity** — rename business, custom storefront art, plot flair
7. **Buyback-and-burn** — protocol SOL revenue (mint + upgrade fees + creator fees)
   periodically market-buys PUMPST and burns it

**Design target: burns ≥ 70% of emissions by end of Season 2.** If the sim shows
otherwise, upgrade costs go up. `lib/simulate.ts` exists to check this before launch,
not after.

---

## 9. NFT ↔ token relationship

The two assets must need each other, or one of them is decoration.

```
        ┌──────────────────────────────────────┐
        │              PLOT (NFT)              │
        │  scarce, tradeable, permanent        │
        └────────────┬─────────────────────────┘
                     │ staked = "occupied"
                     ▼
        ┌──────────────────────────────────────┐
        │        DAILY SETTLEMENT              │
        │  fixed emission → split by weight    │
        └────────────┬─────────────────────────┘
                     │ emits
                     ▼
        ┌──────────────────────────────────────┐
        │            $PUMPST                   │
        └────────────┬─────────────────────────┘
                     │ burned by
                     ▼
        ┌──────────────────────────────────────┐
        │  upgrades · repairs · licenses       │
        │  → raise your PLOT's weight          │
        └────────────┬─────────────────────────┘
                     └──────────► back to weight
```

- **NFT without token:** you earn nothing. The plot is inert.
- **Token without NFT:** you can trade it, but you can't earn it or use its main sink.
- **Both:** the loop closes. PUMPST is the only way to raise a plot's weight, and
  plots are the only way to mint PUMPST.

This is a genuine two-sided dependency, and it's why the token shouldn't launch before
the NFT has utility ready. Launching the token first gives it nothing to do.

---

## 10. Balance targets — and measured results

Checked by `lib/simulate.ts`. **These are measured outputs, not aspirations.**
Run: `npx vite-node` against `runSimulation()`, 2,000 plots, 180 days, seed 42.

| Metric | Target | Measured (70% staked) | Verdict |
|---|---|---|---|
| Burn / emission ratio | ≥ 0.70 | **0.49–0.57** | ⚠️ short — buyback closes it |
| Residential share | 40–60% | 52% | ✅ |
| Enterprise share | 15–30% | 24% | ✅ |
| Gini of lifetime payouts | **0.60–0.72** *(revised)* | 0.70 | ✅ — see below |
| Median days to Tier 3 | 25–40 | 39–54 | ⚠️ slow |
| Worst-case Enterprise drawdown | ≤ 3 days yield | 3 days (capped) | ✅ |
| Year-1 emission | — | 91.67M (9.2% of supply) | ✅ |

### Why the Gini target was revised, not the economy

The original target was 0.35–0.55 and the economy kept measuring 0.70. Before
tuning further, we measured where the inequality actually comes from:

> **Day 1. Every plot at tier 1, identical condition, nobody has upgraded
> anything. Payout spread is already 8.83×** (min 104.6, median 134.1, max 923.8).

So it is not a progression problem, a poverty trap, or a tax problem. It is the
direct arithmetic of three things the design *deliberately* wants:

- **Land rarity is real** — district (0.85–1.35×), landmark (1.25×), corner
  (1.08×), frontage (up to 1.12×). If rare land didn't pay more, there'd be no
  reason for a secondary market to price it.
- **Path choice is a real decision** — Commercial stacks lease term and tenant
  quality; Enterprise swings 0.7–2.2×.
- **Events are dramatic on purpose** — Viral Moment is 4×, Celebrity 2.5×.

Driving the Gini to 0.55 would mean flattening land traits, compressing the
Enterprise band, and defanging events — i.e. making every choice in the game
approximately irrelevant. **The target was wrong, not the design.** Revised to
0.60–0.72, which the economy meets.

The one genuine equaliser kept in place: **district tax runs inverse to district
weight** (Outskirts keeps 79% of yield, The Strip keeps 58%), so cheap land is
compensated on the net rather than the gross.

### Progressive tax brackets

Tier brackets (`TIER_TAX_BRACKET`, 1.0 → 2.0×) were added to lift the burn ratio
and compress net payouts with one mechanic. They lifted burns (0.45 → 0.54 at 90%
staked) but barely moved the Gini — because, per the diagnostic above, tier spread
was never the driver. They stay in because the burn improvement is real and
bracketed property tax is thematically correct.

### The burn ratio gap is real and is not closed here

Measured **0.49–0.57** against a 0.70 goal. Reaching 0.70 through tax alone needs
an effective rate near 55%, which is punitive and would push players off the
street. **The remaining gap must be closed by buyback-and-burn** funded by SOL
revenue (mint fees, upgrade fees, rezoning, pump.fun creator fees) — which the
simulation deliberately does not model, because it depends on secondary volume
nobody can forecast honestly. Treat 0.54 as the modelled floor and the buyback as
the closer. **Do not claim 0.70 until it is observed on mainnet.**

### What the simulation actually taught us

Three findings changed the design, and they're worth recording because they'd
have been expensive to learn on mainnet:

1. **Tier caps created a sink cliff.** Once a player hits the maximum tier their
   lot size allows, upgrades stop — and with them, the main burn. Burn ratio
   collapsed to **0.20**. The fix was the **property tax** (§8), taken as a
   share of yield rather than a flat fee so it can never bankrupt anyone and so
   it keeps burning forever. That single change took burns from 0.20 → 0.45.
2. **Exponential tier weights are oligarchic.** The original curve
   (0.5/1/1.6/2.5/3.8/5.5) produced a payout Gini of 0.71 and made small lots
   feel pointless permanently. Compressing to 0.6/1/1.45/2/2.7/3.5 helped, but
   not enough — see below.
3. **Cheap upgrades don't automatically mean fast progression.** Halving costs
   moved median-days-to-tier-3 from 65 → 28, but then the tax reintroduced drag
   and it settled at ~55.

### Honest status of the two misses

- **Gini at 0.71 vs a 0.55 target.** The remaining spread is driven by
  Enterprise variance compounding over 180 days and by lot-size caps creating a
  permanent ceiling for ~34% of plots. Closing it means either narrowing the
  Enterprise band (which removes the drama that makes the path worth having) or
  loosening lot caps (which removes the land scarcity that gives large lots
  lasting value). **I'd revise the target to 0.60–0.70 and accept it** — a game
  where choices matter should be unequal — but that is a product call, not a
  technical one, and it should be made deliberately rather than by default.
- **Burn ratio at 0.52 vs 0.70.** Reaching 0.70 needs the tax near 55%, which
  starts to feel punitive. The better lever is the **buyback-and-burn** funded
  by SOL revenue (§8), which the simulation does not model because it depends on
  secondary volume. Treat 0.52 as the floor and the buyback as the closer.

**Season 1 is inflationary by construction and no amount of tuning changes that.**
The treasury must be sized to carry it.

---

## 11. Known risks

Stated plainly, because they're real.

- **Emissions still exceed burns early.** Season 1 is inflationary by construction.
  Burns only catch up once a meaningful share of the street is upgrading and
  repairing. Season 1 must be treated as a subsidy, and the treasury sized for it.
- **Oracle dependency.** If Pyth is stale or halted, settlement voids to 1.0×. That's
  safe but boring, and a long outage kills the core loop.
- **Directional sectors are gambling.** LONG/SHORT on SOL with token rewards attached
  is, functionally, a leveraged bet. Depending on jurisdiction this may attract
  regulatory attention. Consider gating directional sectors, or replacing the stance
  mechanic with non-directional sector performance, if that risk isn't acceptable.
- **Mint may not sell out.** Everything above assumes a populated street. At 30%
  mint-through, weight competition is thin, yields look absurd, and the token gets
  farmed and dumped. Phase 2 supply must be gated on Phase 1 actually clearing (§ COSTS).
- **Dev buy optics.** Covered in §8. Disclose or don't do it.

---

## 12. What is deliberately *not* here

- **No fixed APR anywhere.** Not in the docs, not in the UI, not in marketing. The
  moment you print an APR you've made a promise the design specifically refuses to make.
- **No "guaranteed" anything.**
- **No referral/ponzi layer.** Multi-level referral rewards would break the fixed-pie
  invariant and are the fastest route to a rug label.
- **No land expansion beyond Phase 2.** Adding supply later dilutes every existing
  holder and is the most common way these projects lose their community's trust.
