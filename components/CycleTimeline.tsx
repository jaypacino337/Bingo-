'use client';

import { useMemo, useState } from 'react';
import { Counter } from './Counter';
import { Reveal } from './Reveal';
import { asOf, cycles, marketBody, marketHeadline, type CycleSeries } from '@/lib/content';
import { formatValue, pctOffLow } from '@/lib/format';

/**
 * The cycle timeline.
 *
 * Every asset here has the same story — it fell, everyone said it was
 * finished, and it went higher. Four stat cards showed the ending. This shows
 * the pattern, with the quotes pinned to the exact points on the chart they
 * were wrong about.
 *
 * The y-axis is logarithmic. BTC runs 3,200 → 81,000 and SOL runs 0.78 → 260;
 * on a linear axis the early history flattens into the baseline and the
 * "they said it was dead here" pins land on top of each other.
 */

const W = 1000;
const H = 300;
const PAD = { top: 34, right: 24, bottom: 34, left: 24 };

function useGeometry(series: CycleSeries) {
  return useMemo(() => {
    const values = series.points.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const span = logMax - logMin || 1;

    const coords = series.points.map((p, i) => {
      const x = PAD.left + (i / (series.points.length - 1)) * (W - PAD.left - PAD.right);
      const norm = (Math.log10(p.v) - logMin) / span;
      const y = H - PAD.bottom - norm * (H - PAD.top - PAD.bottom);
      return { ...p, x, y, index: i };
    });

    // Catmull-Rom → bezier, so the line curves without overshooting.
    let d = `M ${coords[0]!.x} ${coords[0]!.y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[i - 1] ?? coords[i]!;
      const p1 = coords[i]!;
      const p2 = coords[i + 1]!;
      const p3 = coords[i + 2] ?? p2;
      d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${
        p2.x - (p3.x - p1.x) / 6
      } ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
    }

    const last = coords.at(-1)!;
    const area = `${d} L ${last.x} ${H} L ${coords[0]!.x} ${H} Z`;
    const marks = coords.filter((c) => c.said);

    return { coords, path: d, area, last, marks, low: min };
  }, [series]);
}

export function CycleTimeline() {
  const [active, setActive] = useState(0);
  const series = cycles[active]!;
  const geo = useGeometry(series);

  const now = series.points.at(-1)!.v;
  // Measure the recovery from the last moment anyone called it dead.
  const lastDead = [...series.points].reverse().find((p) => p.said) ?? series.points[0]!;
  const gain = pctOffLow(lastDead.v, now);

  return (
    <section id="market" className="scroll-mt-20 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="label mb-5">01 — The market is back</p>
          <h2 className="h-section mb-5 max-w-3xl">{marketHeadline}</h2>
          <p className="mb-10 max-w-2xl text-[15px] leading-relaxed text-muted">{marketBody}</p>
        </Reveal>

        {/* Tabs */}
        <Reveal>
          <div className="mb-5 flex flex-wrap gap-2">
            {cycles.map((c, i) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setActive(i)}
                className={`rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-label transition-colors ${
                  i === active
                    ? 'border-up bg-up/10 text-up'
                    : 'border-line text-muted hover:border-up/40 hover:text-white'
                }`}
              >
                {c.tab}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Chart */}
        <Reveal>
          <div className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-label text-muted">
                {series.asset} · every time they called it
              </span>
              <span className="num whitespace-nowrap text-[12px] font-bold text-up">
                +<Counter key={series.key} to={gain} decimals={gain < 100 ? 1 : 0} suffix="%" />{' '}
                <span className="text-muted">since the last one</span>
              </span>
            </div>

            <div className="px-2 pt-2">
              {/*
                The line is drawn with preserveAspectRatio="none" so it fills
                any width. Anything round or lettered has to live outside that
                stretch — a squashed "NOW" and oval dots looked broken on a
                phone — so the pins are positioned over the top in HTML.
              */}
              <div className="relative h-[240px] w-full sm:h-[300px]">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="absolute inset-0 h-full w-full"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${series.asset} over time, with the moments it was declared dead`}
                >
                  <defs>
                    <linearGradient id={`cyc-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#19FB7B" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#19FB7B" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <path key={`a-${series.key}`} d={geo.area} fill={`url(#cyc-${series.key})`} />

                  {geo.marks.map((m) => (
                    <line
                      key={`v-${series.key}-${m.index}`}
                      x1={m.x}
                      y1={m.y}
                      x2={m.x}
                      y2={H - PAD.bottom + 14}
                      stroke="#FF5A5A"
                      strokeWidth={1}
                      strokeDasharray="3 4"
                      opacity={0.45}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}

                  <path
                    key={`l-${series.key}`}
                    d={geo.path}
                    fill="none"
                    stroke="#19FB7B"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                    pathLength={1}
                    strokeDasharray={1}
                    className="[animation:draw_1600ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
                  />
                </svg>

                {/* "They called it here" pins */}
                {geo.marks.map((m, i) => (
                  <span
                    key={`p-${series.key}-${m.index}`}
                    className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                    style={{ left: `${(m.x / W) * 100}%`, top: `${(m.y / H) * 100}%` }}
                  >
                    <span className="mb-1 font-mono text-[12px] font-bold leading-none text-white">
                      {i + 1}
                    </span>
                    <span className="relative flex h-2.5 w-2.5 items-center justify-center rounded-full bg-down">
                      <span className="absolute h-5 w-5 rounded-full bg-down/20" />
                    </span>
                  </span>
                ))}

                {/* Now */}
                <span
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${(geo.last.x / W) * 100}%`, top: `${(geo.last.y / H) * 100}%` }}
                >
                  <span className="mb-1 font-mono text-[11px] font-bold uppercase leading-none tracking-label text-up">
                    now
                  </span>
                  <span className="relative flex h-3 w-3 items-center justify-center rounded-full bg-up">
                    <span className="absolute h-6 w-6 rounded-full bg-up/20" />
                  </span>
                </span>
              </div>

              {/* Axis labels, in flow so they don't fight the stretched viewBox */}
              <div className="flex items-center justify-between px-3 pb-3 pt-2">
                <span className="font-mono text-[10px] uppercase tracking-label text-muted/60">
                  {series.points[0]!.when}
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-label text-muted/60 sm:block">
                  log scale
                </span>
                <span className="font-mono text-[10px] uppercase tracking-label text-up/70">
                  {formatValue(now, series.format)}
                </span>
              </div>
            </div>

            {/* The chorus */}
            <ul className="divide-y divide-line border-t border-line">
              {geo.marks.map((m, i) => (
                <li
                  key={`${series.key}-said-${m.index}`}
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-down/[0.035]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-down/15 font-mono text-[11px] font-bold text-down">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] leading-snug text-white/85 sm:text-[15px]">
                      “{m.said}”
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-muted">
                      {m.when} · {formatValue(m.v, series.format)}
                    </p>
                  </div>
                  <span className="num shrink-0 self-center rounded-full bg-up/10 px-2.5 py-1 text-[11px] font-bold text-up">
                    +{Math.round(pctOffLow(m.v, now)).toLocaleString()}%
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-night/70 px-5 py-4">
              <span className="text-[13px] font-bold text-white sm:text-[14px]">
                {series.verdict}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-label text-muted">
                They were sidelined for all of it
              </span>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <p className="mt-6 font-mono text-[10px] uppercase leading-relaxed tracking-label text-muted/60">
            {asOf}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
