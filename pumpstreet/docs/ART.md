# Pump Street — Art Generation Plan

**Goal:** 2,000 plot images for Phase 1 at the lowest cost that still looks
deliberate. Phase 2's 3,000 are generated only if Phase 1 clears.

**Not started.** This is the plan, per your instruction to leave generation until
we'd worked out how to split it.

---

## 1. The insight that makes this cheap

A plot is **a building on a lot**. That decomposes into layers that compose
combinatorially, so you draw far fewer assets than you ship images:

```
  sky / time-of-day  (6)
  ground / lot       (4 lot sizes)
  building body      (6 tiers × 6 districts = 36)
  frontage detail    (3)
  corner variant     (2)
  landmark overlay   (1 rare)
  signage / awning   (12)
  street props       (10)
```

**~74 hand-drawn assets → 2,000 unique combinations.** You are not commissioning
2,000 pictures. You are commissioning roughly 74 and a compositor.

This is also why the building **must be re-renderable**: tier changes when players
upgrade, so the image is a function of state, not a fixed file (§4).

---

## 2. The two-part split

### Part A — Mint art (do this before launch)

Only what's needed to sell a plot: **the lot, before anything is built.**

- Renders the immutable land only: district, lot size, frontage, corner, landmark.
- **~22 assets** (sky, ground, district palette, landmark overlay, props).
- Every plot is an *Empty Lot* at mint, so there are no tier variants to draw yet.
- 2,000 images composited programmatically from the published collection seed.

**This halves your pre-revenue art spend**, because tiers 1–5 don't exist yet.

### Part B — Building art (after mint, funded by mint revenue)

- The 36 building bodies (6 tiers × 6 districts), signage, awnings.
- Ships alongside the upgrade system going live.
- Paid for out of Phase 1 revenue — zero out-of-pocket.

**A player who mints on day one sees an empty lot, which is correct**: they
haven't built anything. The art roadmap and the gameplay roadmap are the same
roadmap, which is a rare thing to get for free.

---

## 3. Cost

| Route | Part A | Part B | Notes |
|---|---:|---:|---|
| Commissioned pixel artist | $400–900 | $700–1,500 | ~22 then ~52 assets. Best result. |
| Asset packs + compositing | $60–150 | $100–250 | Licence must permit commercial NFT use — **verify** |
| AI-generated base, hand-cleaned | $50–200 | $150–400 | Disclose it; see §6 |

**Recommendation: commissioned pixel art.** At 2,000 supply and $11.34 a mint,
the art *is* the product surface — it is the thing people screenshot. Part A at
$400–900 against a $22,680 raise is the highest-leverage money in the budget.

Storage is negligible either way: 2,000 × ~200KB ≈ 400MB ≈ **~0.15 SOL (~$11)**
on Arweave via Irys, cheaper on IPFS.

---

## 4. Metadata must be dynamic

This is the part most projects get wrong and can't undo.

A plot's image changes when the owner upgrades. So the `uri` cannot point at a
frozen PNG — it points at a **render endpoint keyed by plot number**, which reads
current on-chain state and returns the right composite:

```
https://pumpstreet.xyz/api/plot/1247.png   → composites tier, path, condition
https://pumpstreet.xyz/api/plot/1247.json  → traits, live
```

Requirements:
- **Cache aggressively**, invalidate on the upgrade/repair/settle events the
  program already emits (`PlotSettled`).
- **Pin an immutable snapshot to Arweave at each tier change**, so there's a
  permanent record even if the renderer disappears. This is the honest
  compromise between "fully on-chain" and "actually shippable".
- **Land traits are immutable and must be baked at mint** — district, lot size,
  frontage, corner, landmark never change and should be in the metadata from
  block one, so rarity is verifiable without trusting the API.

---

## 5. Verifiable rarity

`lib/plots.ts` already derives every land attribute deterministically from the
collection seed. Publishing the seed **before** the mint lets anyone reproduce the
full distribution and confirm the rare lots weren't handed to insiders.

```bash
# anyone can run this and check the distribution
generateCollection(2000, COLLECTION_SEED)
```

Given how much of this session went into tracing insider allocations on other
launches, do this. It costs nothing and it removes the single most common
accusation levelled at a new mint.

**Publish before mint opens:**
- the collection seed
- the distribution table (districts, lot sizes, landmark rate)
- the dev-buy wallet and its vesting

---

## 6. Risks

- **Asset-pack licensing.** Many packs forbid NFT use outright. Read the licence;
  a takedown after mint is fatal.
- **AI-generated art.** Workable, but disclose it. Undisclosed AI art discovered
  post-mint reliably becomes the story, and copyright status is unsettled.
- **Renderer as a single point of failure.** Mitigated by the Arweave snapshots
  in §4 — do not skip them.
- **Don't draw Phase 2 districts early.** Phase 2 may never happen. Its art is
  contingent on Phase 1 clearing 85%, same as its supply.

---

## 7. Order of work

1. Publish the collection seed + distribution table
2. Commission **Part A only** (~22 assets)
3. Build the compositor; generate 2,000 lot images from the seed
4. Upload to Arweave; bake immutable land traits into metadata
5. Stand up the render endpoint with caching
6. **Mint Phase 1**
7. Commission Part B from revenue; ship it with the upgrade system
