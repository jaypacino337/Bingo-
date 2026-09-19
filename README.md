# SIDELINED

The market came back. A lot of people didn't.

A static landing page — Next.js, TypeScript, Tailwind. No backend, no wallet
logic, no API. It builds to four static routes and ships.

```
app/          layout, page, favicon
components/   one file per section
lib/content.ts   ← all copy and numbers live here
lib/site.ts      ← CA and socials, read from env
public/receipts/ ← drop your screenshots here
public/brand/    ← logo, banner, og image
```

---

## Deploy

**Vercel → Add New → Project → import this repo → Deploy.**

Leave every build setting alone. Next.js is at the repo root, so **Root
Directory must be empty**. There is nothing else to configure.

Then add the environment variables from [`.env.example`](.env.example):

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_TOKEN_MINT` | your CA — shown in the nav (click to copy), drives the buy link |
| `NEXT_PUBLIC_TOKEN_SYMBOL` | ticker used in the copy |
| `NEXT_PUBLIC_TWITTER_URL` | X link — the button hides itself if blank |
| `NEXT_PUBLIC_TELEGRAM_URL` | optional |
| `NEXT_PUBLIC_BUY_URL` | only if you launch somewhere other than pump.fun |
| `NEXT_PUBLIC_SITE_URL` | your domain, for OG tags |

`NEXT_PUBLIC_*` values are compiled in at build time — **redeploy after
changing them** or the site keeps the old ones.

Until the CA is set, the nav shows `CA: TBA` and the buy buttons point at
pump.fun. Nothing breaks.

---

## Editing the site

**Every piece of visible text and every number is in
[`lib/content.ts`](lib/content.ts).** No component holds its own copy. Change
that one file and the whole page follows.

### ⚠️ The numbers are placeholders

The market stats, the `$1,000` table, the percentages — all shaped like real
data so the layout is honest, but **none of it is real or sourced**. Replace
them before you launch, and update `asOf` (it currently reads "Placeholder
data — update before launch" and prints under both data sections, on purpose).

Four things to edit:

```ts
marketStats   // BTC / SOL / volume cards — low, now, % off lows, sparkline shape
lowsRows      // the $1,000 table — entry, current, and the multiple
receipts      // the screenshot wall
hero, thesis… // all the headline copy
```

`series` on a market stat is just 0–1 values, oldest first. It draws the
sparkline shape — it is not price data and does not need to be.

### Adding screenshots

Drop files into `public/receipts/`, then list them:

```ts
export const receipts: Receipt[] = [
  { src: '/receipts/cope-01.png', handle: '@someone' },
  { quote: 'still sidelined tbh', handle: '@anon' },  // no image → quote card
];
```

The wall is a masonry layout, so screenshots of any height pack without gaps
and nothing gets cropped. Entries with a `quote` and no `src` render as quote
cards in the same visual language — **the wall looks finished before you have
a single screenshot**, so you can ship now and add receipts as you collect
them. See [`public/receipts/README.md`](public/receipts/README.md).

### Logo and banner

`public/brand/`. The nav mark is currently an inline SVG (a line breaking out
of a flat base) at the bottom of `components/Nav.tsx` — swap it there.

---

## Sections

| # | Section | Component |
| --- | --- | --- |
| — | Hero + `missed_move.log` terminal | `Hero.tsx` |
| — | Ticker | `Ticker.tsx` |
| 01 | The market is back | `MarketBack.tsx` |
| 02 | $1,000 at the lows | `MissedMove.tsx` |
| 03 | Receipts | `Receipts.tsx` |
| 04 | The thesis | `Thesis.tsx` |
| 05 | Why now | `WhyNow.tsx` |
| — | Final CTA + footer | `FinalCta.tsx`, `Footer.tsx` |

---

## Motion

No animation library. Everything is CSS plus three small client components:

- **`Reveal`** — fades sections up on scroll, once, via IntersectionObserver
- **`Counter`** — counts numbers up when first seen, eased, snapping to the
  exact value on the last frame
- **`ChartLine`** — SVG line that draws itself in, with a Catmull-Rom smoothed
  path so it curves without overshooting

All three respect `prefers-reduced-motion` and render their final state
immediately when it is set.

---

## Local

```bash
npm install
npm run dev     # :3000
```

```bash
npm run build      # static export check
npm run typecheck  # tsc, no emit
```

---

## One gotcha worth knowing

Don't name a Tailwind colour `base`, `sm`, `lg`, `xl` or anything else in the
font-size scale. `text-base` is a font-size utility; adding a colour by that
name makes `text-base` set a colour too, and text silently repaints itself the
background colour. The dark background token here is `night` for that reason.
