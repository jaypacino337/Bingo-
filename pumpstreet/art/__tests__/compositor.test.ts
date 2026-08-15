import { describe, expect, it } from 'vitest';
import { generateCollection, generatePlot } from '../../lib/plots';
import { PALETTES, plotMetadata, renderPlot } from '../compositor';
import { rarityReport } from '../render';
import type { District } from '../../lib/types';

const SEED = 20260815;

describe('compositor', () => {
  it('produces valid, self-contained SVG', () => {
    const svg = renderPlot(generatePlot(1, SEED));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // No external resource fetches — the image must not depend on a remote
    // host at render time. The xmlns URI is a namespace identifier, never
    // fetched, so it is excluded.
    const withoutNamespace = svg.replace(/xmlns(:\w+)?="[^"]*"/g, '');
    expect(withoutNamespace).not.toMatch(/https?:\/\//);
    expect(svg).not.toMatch(/<image\b/);
    expect(svg).not.toMatch(/xlink:href/);
  });

  it('is deterministic for the same plot and seed', () => {
    expect(renderPlot(generatePlot(42, SEED))).toBe(renderPlot(generatePlot(42, SEED)));
  });

  it('renders every district without throwing', () => {
    for (const d of Object.keys(PALETTES) as District[]) {
      const p = generatePlot(1, SEED);
      const svg = renderPlot({ ...p, land: { ...p.land, district: d } });
      expect(svg.length).toBeGreaterThan(500);
    }
  });

  it('renders larger lots with a bigger footprint', () => {
    const p = generatePlot(7, SEED);
    const small = renderPlot({ ...p, land: { ...p.land, lotSize: 1 } });
    const large = renderPlot({ ...p, land: { ...p.land, lotSize: 4 } });
    expect(small).not.toBe(large);
  });

  it('draws the landmark overlay only for landmark plots', () => {
    const p = generatePlot(11, SEED);
    const plain = renderPlot({ ...p, land: { ...p.land, landmark: false } });
    const marked = renderPlot({ ...p, land: { ...p.land, landmark: true } });
    expect(plain).not.toContain('#FFD25A');
    expect(marked).toContain('#FFD25A');
  });

  it('labels every plot as an unbuilt empty lot in Part A', () => {
    const svg = renderPlot(generatePlot(99, SEED));
    expect(svg).toContain('EMPTY LOT');
  });
});

describe('metadata', () => {
  const plot = generatePlot(1247, SEED);
  const meta = plotMetadata(plot, 'https://pumpstreet.xyz');

  it('bakes immutable land traits in, so rarity needs no trusted API', () => {
    const traits = Object.fromEntries(
      meta.attributes.map((a) => [a.trait_type, a.value]),
    );
    expect(traits['Lot Size']).toBe(plot.land.lotSize);
    expect(traits['Frontage']).toBe(plot.land.frontage);
    expect(traits['Landmark']).toBe(plot.land.landmark ? 'Yes' : 'No');
    expect(traits['District']).toBeTruthy();
  });

  it('points image at the render endpoint, since tiers change after mint', () => {
    expect(meta.image).toBe('https://pumpstreet.xyz/api/plot/1247.png');
  });

  it('caps max tier by lot size', () => {
    const traits = Object.fromEntries(
      meta.attributes.map((a) => [a.trait_type, a.value]),
    );
    expect(traits['Max Tier']).toBe({ 1: 2, 2: 3, 3: 4, 4: 5 }[plot.land.lotSize]);
  });
});

describe('rarity report', () => {
  const plots = generateCollection(2000, SEED);
  const report = rarityReport(plots, SEED);

  it('accounts for every plot exactly once', () => {
    const total = Object.values(report.districts).reduce((a, b) => a + b, 0);
    expect(total).toBe(2000);
    expect(report.supply).toBe(2000);
  });

  it('keeps landmarks genuinely rare', () => {
    const rate = report.landmarks / report.supply;
    expect(rate).toBeGreaterThan(0.005);
    expect(rate).toBeLessThan(0.035);
  });

  it('keeps the largest lots scarce, so Towers stay scarce', () => {
    const rate = (report.lotSizes[4] ?? 0) / report.supply;
    expect(rate).toBeGreaterThan(0.03);
    expect(rate).toBeLessThan(0.10);
  });

  it('is reproducible from the published seed', () => {
    expect(rarityReport(generateCollection(2000, SEED), SEED)).toEqual(report);
  });
});
