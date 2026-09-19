'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * A rising line chart that draws itself when scrolled into view.
 *
 * The line is a smoothed path through the supplied series, with an area fill
 * underneath and a dot parked on the final point. Everything is SVG — no
 * charting library for what is, at the end of it, one polyline.
 */

/** Catmull-Rom → cubic bezier, so the line curves without overshooting. */
function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0]![0]} ${points[0]![1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function ChartLine({
  series,
  width = 300,
  height = 96,
  strokeWidth = 2,
  showDot = true,
  className = '',
}: {
  /** 0-1 values, oldest first. */
  series: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  showDot?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<SVGSVGElement | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDrawn(true);
      return;
    }
    if (node.getBoundingClientRect().top < window.innerHeight) {
      // Next frame, so the transition has an initial state to animate from.
      const t = requestAnimationFrame(() => setDrawn(true));
      return () => cancelAnimationFrame(t);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pad = strokeWidth + 2;
  const points: [number, number][] = series.map((v, i) => [
    (i / Math.max(1, series.length - 1)) * (width - pad * 2) + pad,
    height - pad - v * (height - pad * 2),
  ]);

  const line = smoothPath(points);
  const last = points.at(-1)!;
  const area = `${line} L ${last[0]} ${height} L ${points[0]![0]} ${height} Z`;

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#19FB7B" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#19FB7B" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d={area}
        fill={`url(#fill-${id})`}
        style={{ opacity: drawn ? 1 : 0, transition: 'opacity 900ms ease 500ms' }}
      />

      <path
        d={line}
        fill="none"
        stroke="#19FB7B"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray={1}
        style={{
          strokeDashoffset: drawn ? 0 : 1,
          transition: 'stroke-dashoffset 1500ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {showDot ? (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={strokeWidth + 1.6}
          fill="#19FB7B"
          style={{
            opacity: drawn ? 1 : 0,
            transition: 'opacity 400ms ease 1300ms',
          }}
        />
      ) : null}
    </svg>
  );
}
