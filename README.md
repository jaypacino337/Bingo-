# zSOL

Shielded SOL on Solana. Deposit SOL, hold zSOL, withdraw to a fresh address with a
zero-knowledge proof that your deposit is not one of the flagged ones.

This repository is the landing page. Static, single file, no build step and no
dependencies.

```
index.html     the whole site
vercel.json    clean URLs + security headers
```

## Deploy

Vercel auto-detects this as a static site — there is no framework to configure.

1. **Add New → Project**, import this repository.
2. Framework Preset: **Other**. Leave Root Directory, build command and output
   directory empty.
3. Deploy, then **Settings → Domains** to attach the domain.

## Local preview

Open `index.html` in a browser, or:

```bash
npx serve .
```

## Editing

Everything is in `index.html`: design tokens in `:root` at the top, copy in the
body, the pool visualiser in the single `<script>` at the bottom.

Colors are CSS custom properties declared **three times** — on `:root` for light,
under `prefers-color-scheme: dark`, and under `[data-theme="dark"]`. Change a color
in all three or the page breaks in one theme.

## Content accuracy

The page states in three places that nothing is deployed or audited, and carries no
fabricated metrics. If that changes, update all three together or they will
contradict each other:

- the status pill in the header
- the `.note` block under the demo
- the footer

The association-set design follows Buterin, Illum, Nadler, Schär and Soleimani
(2023), [*Blockchain Privacy and Regulatory Compliance: Towards a Practical
Equilibrium*](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4563364). Keep the
citation as long as the mechanism description stands.

## History

This repository previously held the SIDELINED landing page, replaced in full by
zSOL. That work is intact in git history at commit `0a2da22` and can be restored
with `git revert` on the replacement commit.

## Turning on the waitlist

The launch section has a working email form. To collect signups for real, do one
two-minute step:

1. Create a free form at **[formspree.io](https://formspree.io)** (or any endpoint
   that accepts a `POST` with an `email` field).
2. In `index.html`, find `WAITLIST_ENDPOINT = ""` near the bottom and paste your
   form URL between the quotes.

Until you set that, the form falls back to opening the visitor's email app
addressed to `WAITLIST_FALLBACK_EMAIL` — change that constant to your real inbox
so no signup is lost. Both values sit side by side in the one `<script>` block.
