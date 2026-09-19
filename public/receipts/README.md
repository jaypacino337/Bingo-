# public/receipts/

Drop your KOL / tweet screenshots in here, then list them in
`lib/content.ts` under `receipts`:

```ts
export const receipts: Receipt[] = [
  { src: '/receipts/cope-01.png', handle: '@someone' },
  { src: '/receipts/cope-02.png', handle: '@someoneelse' },
  { quote: 'still sidelined tbh', handle: '@anon' },  // no image yet — renders as a quote card
];
```

**Format:** PNG or JPG, roughly 600–900px wide. Heights can vary — the wall is
a masonry layout, so nothing gets cropped and the handle never gets cut off.

Mix `src` and `quote` entries freely. The wall looks finished either way, so
you can ship before you've collected every screenshot.

One thing worth checking before you post them: screenshots of other people's
posts are their content, and a few of the bigger accounts do care. Cropping to
the text and keeping the handle visible is the normal courtesy.
