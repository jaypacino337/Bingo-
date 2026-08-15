import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCollection } from '../lib/plots';
import { PHASE_1_SUPPLY } from '../lib/constants';
import { plotMetadata, renderPlot } from './compositor';
import type { District, Plot } from '../lib/types';

/**
 * Part A renderer — writes every empty lot as SVG plus its metadata JSON.
 *
 * Deterministic: same seed in, byte-identical output. That is what lets anyone
 * reproduce the collection and verify the rare lots were not handed to insiders
 * (docs/ART.md §5).
 *
 *   npx vite-node pumpstreet/art/render.ts -- --seed 20260815 --out ./out
 */

interface Args {
  seed: number;
  supply: number;
  out: string;
  baseUrl: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    seed: Number(get('--seed', '20260815')),
    supply: Number(get('--supply', String(PHASE_1_SUPPLY))),
    out: get('--out', './out'),
    baseUrl: get('--base-url', 'https://pumpstreet.xyz'),
  };
}

export interface RarityReport {
  supply: number;
  seed: number;
  districts: Record<string, number>;
  lotSizes: Record<number, number>;
  frontage: Record<number, number>;
  cornerLots: number;
  landmarks: number;
}

/** The distribution table published before mint so rarity is verifiable. */
export function rarityReport(plots: Plot[], seed: number): RarityReport {
  const districts: Record<string, number> = {};
  const lotSizes: Record<number, number> = {};
  const frontage: Record<number, number> = {};
  let cornerLots = 0;
  let landmarks = 0;

  for (const p of plots) {
    const d = p.land.district as District;
    districts[d] = (districts[d] ?? 0) + 1;
    lotSizes[p.land.lotSize] = (lotSizes[p.land.lotSize] ?? 0) + 1;
    frontage[p.land.frontage] = (frontage[p.land.frontage] ?? 0) + 1;
    if (p.land.cornerLot) cornerLots++;
    if (p.land.landmark) landmarks++;
  }

  return { supply: plots.length, seed, districts, lotSizes, frontage, cornerLots, landmarks };
}

export function render(args: Args): RarityReport {
  const plots = generateCollection(args.supply, args.seed);

  const imgDir = join(args.out, 'images');
  const metaDir = join(args.out, 'metadata');
  mkdirSync(imgDir, { recursive: true });
  mkdirSync(metaDir, { recursive: true });

  for (const plot of plots) {
    const n = plot.land.plotNumber;
    writeFileSync(join(imgDir, `${n}.svg`), renderPlot(plot), 'utf8');
    writeFileSync(
      join(metaDir, `${n}.json`),
      JSON.stringify(plotMetadata(plot, args.baseUrl), null, 2),
      'utf8',
    );
  }

  const report = rarityReport(plots, args.seed);
  writeFileSync(join(args.out, 'rarity.json'), JSON.stringify(report, null, 2), 'utf8');
  return report;
}

// Run as a CLI, but stay inert when imported by the test suite. Checking
// argv[1] is unreliable here because the runner, not this file, owns it.
if (!process.env.VITEST) {
  const args = parseArgs(process.argv.slice(2));
  const report = render(args);
  console.log(`Rendered ${report.supply} plots (seed ${report.seed}) -> ${args.out}`);
  console.log(JSON.stringify(report, null, 2));
  console.log(
    '\nRasterise to PNG with any SVG tool, e.g.:\n' +
      `  for f in ${args.out}/images/*.svg; do rsvg-convert -w 640 "$f" -o "\${f%.svg}.png"; done`,
  );
}
