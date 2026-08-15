import { makeRng } from '../lib/rng';
import type { District, Land, Plot } from '../lib/types';

/**
 * Part A compositor — renders the *empty lot*.
 *
 * Every plot is an Empty Lot at mint, so nothing here draws a building. That is
 * the whole cost saving in docs/ART.md: ~22 layer definitions instead of the ~74
 * needed once tiers exist. Part B (buildings) plugs into `renderPlot` later via
 * the `tier` branch, funded by mint revenue.
 *
 * Output is SVG: deterministic, diff-able, tiny, and rasterises to PNG with any
 * standard tool. No runtime dependencies.
 */

export const CANVAS = 640;

interface Palette {
  skyTop: string;
  skyBottom: string;
  ground: string;
  groundShade: string;
  pavement: string;
  accent: string;
  name: string;
}

const PALETTES: Record<District, Palette> = {
  STRIP: {
    skyTop: '#1B0B2E',
    skyBottom: '#5A1E5C',
    ground: '#2A1436',
    groundShade: '#1C0E24',
    pavement: '#3D2450',
    accent: '#FF4FD8',
    name: 'The Strip',
  },
  OLD_TOWN: {
    skyTop: '#12253A',
    skyBottom: '#3E5B72',
    ground: '#2E2A22',
    groundShade: '#1F1C17',
    pavement: '#4A4335',
    accent: '#E8B04B',
    name: 'Old Town',
  },
  RIVERSIDE: {
    skyTop: '#0C2C3A',
    skyBottom: '#2E7B84',
    ground: '#1C3A32',
    groundShade: '#132821',
    pavement: '#2F5348',
    accent: '#5BE49B',
    name: 'Riverside',
  },
  GRID: {
    skyTop: '#07160E',
    skyBottom: '#14432B',
    ground: '#0E2A1B',
    groundShade: '#091C12',
    pavement: '#1B4530',
    accent: '#24C37A',
    name: 'The Grid',
  },
  WAREHOUSE: {
    skyTop: '#1A1712',
    skyBottom: '#4A3B27',
    ground: '#2B2419',
    groundShade: '#1C1811',
    pavement: '#413524',
    accent: '#D08B3C',
    name: 'Warehouse Row',
  },
  OUTSKIRTS: {
    skyTop: '#101A14',
    skyBottom: '#2B3B2E',
    ground: '#1E2A20',
    groundShade: '#141C16',
    pavement: '#2C3B2F',
    accent: '#8FA98F',
    name: 'Outskirts',
  },
};

/** Lot footprint in isometric units, driven by lotSize. */
const LOT_FOOTPRINT: Record<number, { w: number; d: number }> = {
  1: { w: 150, d: 110 },
  2: { w: 195, d: 140 },
  3: { w: 240, d: 170 },
  4: { w: 290, d: 205 },
};

function iso(x: number, y: number, cx: number, cy: number): [number, number] {
  return [cx + (x - y) * 0.86, cy + (x + y) * 0.5];
}

function poly(points: [number, number][], fill: string, extra = ''): string {
  const d = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<polygon points="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
}

/** The flat lot slab, drawn as an isometric quad with an extruded edge. */
function lotSlab(land: Land, p: Palette, cx: number, cy: number): string {
  const { w, d } = LOT_FOOTPRINT[land.lotSize];
  const h = 14;

  const a = iso(-w / 2, -d / 2, cx, cy);
  const b = iso(w / 2, -d / 2, cx, cy);
  const c = iso(w / 2, d / 2, cx, cy);
  const e = iso(-w / 2, d / 2, cx, cy);

  const down = ([x, y]: [number, number]): [number, number] => [x, y + h];

  return [
    // extruded sides first so the top sits over them
    poly([e, c, down(c), down(e)], p.groundShade),
    poly([c, b, down(b), down(c)], p.groundShade, 'opacity="0.75"'),
    poly([a, b, c, e], p.ground),
    // lot outline
    poly([a, b, c, e], 'none', `stroke="${p.accent}" stroke-width="1.5" opacity="0.5"`),
  ].join('');
}

/** Pavement strip along the street-facing edge; width scales with frontage. */
function frontageStrip(land: Land, p: Palette, cx: number, cy: number): string {
  const { w, d } = LOT_FOOTPRINT[land.lotSize];
  const depth = 10 + land.frontage * 9;

  const a = iso(-w / 2, d / 2, cx, cy);
  const b = iso(w / 2, d / 2, cx, cy);
  const c = iso(w / 2, d / 2 + depth, cx, cy);
  const e = iso(-w / 2, d / 2 + depth, cx, cy);

  const kerb = poly(
    [a, b, c, e],
    'none',
    `stroke="${p.accent}" stroke-width="1" opacity="0.28" stroke-dasharray="5 6"`,
  );
  return poly([a, b, c, e], p.pavement) + kerb;
}

/** A second pavement run down the side — only corner lots get this. */
function cornerStrip(land: Land, p: Palette, cx: number, cy: number): string {
  if (!land.cornerLot) return '';
  const { w, d } = LOT_FOOTPRINT[land.lotSize];
  const depth = 18;

  const a = iso(w / 2, -d / 2, cx, cy);
  const b = iso(w / 2 + depth, -d / 2, cx, cy);
  const c = iso(w / 2 + depth, d / 2 + 10 + land.frontage * 9, cx, cy);
  const e = iso(w / 2, d / 2 + 10 + land.frontage * 9, cx, cy);

  return poly([a, b, c, e], p.pavement, 'opacity="0.9"');
}

/** Deterministic street furniture. Placement is seeded, never random at runtime. */
function props(land: Land, p: Palette, cx: number, cy: number): string {
  const rng = makeRng((land.plotNumber * 2654435761) >>> 0);
  const { w, d } = LOT_FOOTPRINT[land.lotSize];
  const count = 2 + Math.floor(rng() * 3);
  const out: string[] = [];

  for (let i = 0; i < count; i++) {
    const px = (rng() - 0.5) * w * 0.8;
    const py = (rng() - 0.5) * d * 0.8;
    const [x, y] = iso(px, py, cx, cy);
    const kind = rng();

    if (kind < 0.4) {
      // survey stake
      out.push(
        `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y - 16).toFixed(1)}" stroke="${p.accent}" stroke-width="1.6" opacity="0.65"/>`,
        `<circle cx="${x.toFixed(1)}" cy="${(y - 17).toFixed(1)}" r="2.4" fill="${p.accent}" opacity="0.8"/>`,
      );
    } else if (kind < 0.75) {
      // rubble pile
      out.push(
        `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="9" ry="4.5" fill="${p.groundShade}" opacity="0.85"/>`,
      );
    } else {
      // scrub
      out.push(
        `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-4 -9 M${x.toFixed(1)} ${y.toFixed(1)} l0 -12 M${x.toFixed(1)} ${y.toFixed(1)} l4 -8" stroke="${p.accent}" stroke-width="1.3" opacity="0.4" fill="none"/>`,
      );
    }
  }
  return out.join('');
}

/** Rare permanent marker — the 1.5% landmark trait. */
function landmarkOverlay(land: Land, cx: number, cy: number): string {
  if (!land.landmark) return '';
  const [x, y] = iso(0, 0, cx, cy);
  return [
    `<circle cx="${x.toFixed(1)}" cy="${(y - 46).toFixed(1)}" r="26" fill="none" stroke="#FFD25A" stroke-width="1.2" opacity="0.35"/>`,
    `<path d="M${x.toFixed(1)} ${(y - 68).toFixed(1)} l6.5 13.5 15 2.2 -10.9 10.4 2.6 14.9 -13.2 -7 -13.2 7 2.6 -14.9 -10.9 -10.4 15 -2.2 Z" fill="#FFD25A" opacity="0.92"/>`,
  ].join('');
}

function textLayer(land: Land, p: Palette): string {
  const mono = 'ui-monospace,SFMono-Regular,Menlo,monospace';
  return `
  <text x="34" y="52" font-family="${mono}" font-size="30" font-weight="700" fill="#F3FBF6">#${land.plotNumber}</text>
  <text x="34" y="74" font-family="${mono}" font-size="12" letter-spacing="2.4" fill="${p.accent}" opacity="0.85">${p.name.toUpperCase()}</text>
  <text x="${CANVAS - 34}" y="52" text-anchor="end" font-family="${mono}" font-size="12" letter-spacing="2" fill="#F3FBF6" opacity="0.55">LOT ${land.lotSize}/4</text>
  <text x="${CANVAS - 34}" y="72" text-anchor="end" font-family="${mono}" font-size="12" letter-spacing="2" fill="#F3FBF6" opacity="0.4">FRONTAGE ${land.frontage}/3</text>
  <text x="34" y="${CANVAS - 30}" font-family="${mono}" font-size="11" letter-spacing="2.4" fill="#F3FBF6" opacity="0.35">EMPTY LOT · UNBUILT</text>`;
}

/**
 * Render one plot to SVG.
 *
 * `tier` is accepted but unused in Part A — every plot is an empty lot at mint.
 * Part B branches here to draw the building body.
 */
export function renderPlot(plot: Plot): string {
  const land = plot.land;
  const p = PALETTES[land.district];
  const cx = CANVAS / 2;
  const cy = CANVAS / 2 + 30;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${p.skyTop}"/>
      <stop offset="100%" stop-color="${p.skyBottom}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="62%" r="55%">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#sky)"/>
  <rect width="${CANVAS}" height="${CANVAS}" fill="url(#glow)"/>
  ${frontageStrip(land, p, cx, cy)}
  ${cornerStrip(land, p, cx, cy)}
  ${lotSlab(land, p, cx, cy)}
  ${props(land, p, cx, cy)}
  ${landmarkOverlay(land, cx, cy)}
  ${textLayer(land, p)}
</svg>`;
}

/**
 * Metadata for a plot.
 *
 * Land traits are baked in and immutable, so rarity is verifiable without
 * trusting the render API (docs/ART.md §4). `image` points at the render
 * endpoint because the picture changes when the owner upgrades.
 */
export function plotMetadata(plot: Plot, baseUrl: string) {
  const land = plot.land;
  return {
    name: `Pump Street #${land.plotNumber}`,
    symbol: 'PLOT',
    description:
      'A plot on Pump Street. Pick a path — rent to tenants, lease to a business, or run your own — and earn a share of the daily emission.',
    image: `${baseUrl}/api/plot/${land.plotNumber}.png`,
    external_url: `${baseUrl}/street?plot=${land.plotNumber}`,
    attributes: [
      { trait_type: 'District', value: PALETTES[land.district].name },
      { trait_type: 'Lot Size', value: land.lotSize },
      { trait_type: 'Frontage', value: land.frontage },
      { trait_type: 'Block', value: land.block },
      { trait_type: 'Corner Lot', value: land.cornerLot ? 'Yes' : 'No' },
      { trait_type: 'Landmark', value: land.landmark ? 'Yes' : 'No' },
      { trait_type: 'Max Tier', value: { 1: 2, 2: 3, 3: 4, 4: 5 }[land.lotSize] ?? 2 },
    ],
    properties: {
      category: 'image',
      files: [{ uri: `${baseUrl}/api/plot/${land.plotNumber}.png`, type: 'image/png' }],
    },
  };
}

export { PALETTES };
