'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up the first time it is seen.
 *
 * Eases out so it lands rather than stopping dead, and snaps to the exact
 * value on the last frame — a counter that settles on 81.97 instead of 82
 * looks broken.
 */
export function Counter({
  to,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1400,
  className = '',
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(to);
      return;
    }

    let frame = 0;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();

      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutExpo
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        setValue(to * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
        else setValue(to);
      };
      frame = requestAnimationFrame(tick);
    };

    if (node.getBoundingClientRect().top < window.innerHeight) {
      run();
    } else {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            run();
            observer.disconnect();
          }
        },
        { threshold: 0.2 },
      );
      observer.observe(node);
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
      };
    }

    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
