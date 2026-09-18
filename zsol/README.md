# zSOL — landing page

Static, single file. No build step, no dependencies, no framework.

```
zsol/
  index.html     the whole site
  vercel.json    security headers + clean URLs
```

## Deploy to Vercel

1. **Add New → Project**, import this repository.
2. Set **Root Directory** to `zsol`. This is the important one — without it Vercel
   builds the Next.js app at the repo root instead.
3. Framework Preset: **Other**. Leave build and output commands empty.
4. Deploy.

Then **Settings → Domains** to attach the domain once you've bought it.

## Local preview

Open `index.html` in a browser, or:

```bash
npx serve zsol
```

## Editing

Everything lives in `index.html`: tokens in `:root` at the top, copy in the body,
the pool visualiser in the one `<script>` at the bottom.

Colors are CSS custom properties defined three times — once on `:root` for light,
once under `prefers-color-scheme: dark`, once under `[data-theme="dark"]`. Change a
color in all three or the page breaks in one theme.

## Content accuracy

The page states in three places that nothing is deployed or audited, and carries no
fabricated metrics. If that changes, update the status pill in the header, the
`.note` block under the demo, and the footer together — they must not disagree.

The association-set design follows Buterin, Illum, Nadler, Schär and Soleimani
(2023), *Blockchain Privacy and Regulatory Compliance: Towards a Practical
Equilibrium*. Keep the citation if the mechanism description stays.
