# public/brand/

Drop your logo and banner here:

- `logo.png` — square, 512×512 or larger
- `banner.png` — 1500×500 for X, or 1200×630 for link previews

The nav currently uses an inline SVG mark (a line breaking out of a flat
base). To swap in your logo, edit the `Mark` component at the bottom of
`components/Nav.tsx`.

For link previews, add `og.png` (1200×630) here and reference it in
`app/layout.tsx` under `openGraph.images`.
