'use client';

import { useMemo } from 'react';

/**
 * The mascot: a green cow with notes flying out of it.
 *
 * Drawn inline rather than shipped as an image so it stays crisp at any size
 * and the notes can be animated individually. Set `spraying` while a drop is
 * being sent to make it go properly wild.
 */

interface Note {
  dx: number;
  dy: number;
  rot: number;
  dur: number;
  delay: number;
  left: number;
  top: number;
  scale: number;
}

function buildNotes(count: number, seed: number): Note[] {
  // Deterministic so the server and client agree on first paint.
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  return Array.from({ length: count }, () => {
    const dir = rand() < 0.5 ? -1 : 1;
    return {
      dx: dir * (60 + rand() * 150),
      dy: -(80 + rand() * 190),
      rot: (rand() - 0.5) * 200,
      dur: 2 + rand() * 1.9,
      delay: rand() * 2.6,
      left: 34 + rand() * 32,
      top: 18 + rand() * 22,
      scale: 0.7 + rand() * 0.7,
    };
  });
}

function Banknote({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="38" height="22" rx="3" fill="#22D46B" stroke="#0B0D0C" strokeWidth="2" />
      <circle cx="20" cy="12" r="6" fill="#CFF6DE" stroke="#0B0D0C" strokeWidth="1.6" />
      <path
        d="M20 8.4v7.2M18 10.1c0-.9.9-1.4 2-1.4s2 .5 2 1.4-.9 1.3-2 1.6-2 .7-2 1.6.9 1.4 2 1.4 2-.5 2-1.4"
        stroke="#0B0D0C"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="12" r="1.6" fill="#0B0D0C" />
      <circle cx="34" cy="12" r="1.6" fill="#0B0D0C" />
    </svg>
  );
}

export function CashCow({
  className = '',
  spraying = false,
  noteCount = 14,
}: {
  className?: string;
  spraying?: boolean;
  noteCount?: number;
}) {
  const notes = useMemo(() => buildNotes(noteCount, 20240917), [noteCount]);

  return (
    <div className={`relative select-none ${className}`}>
      {/* Notes spraying out from behind the cow */}
      <div className="pointer-events-none absolute inset-0">
        {notes.map((note, i) => (
          <span
            key={i}
            className="absolute animate-cash-fly"
            style={
              {
                left: `${note.left}%`,
                top: `${note.top}%`,
                '--dx': `${note.dx}px`,
                '--dy': `${note.dy}px`,
                '--rot': `${note.rot}deg`,
                '--dur': `${spraying ? note.dur * 0.5 : note.dur}s`,
                animationDelay: `${spraying ? note.delay * 0.3 : note.delay}s`,
              } as React.CSSProperties
            }
          >
            <Banknote className="h-5 w-8" />
          </span>
        ))}
      </div>

      {/* The cow */}
      <svg viewBox="0 0 260 230" className="relative w-full animate-chew" aria-label="Cash Cow">
        {/* body */}
        <ellipse cx="130" cy="163" rx="84" ry="52" fill="#22D46B" stroke="#0B0D0C" strokeWidth="6" />
        <ellipse cx="92" cy="156" rx="19" ry="14" fill="#00722F" />
        <ellipse cx="170" cy="174" rx="15" ry="11" fill="#00722F" />
        {/* udder — unmistakably a cow */}
        <ellipse cx="130" cy="203" rx="24" ry="14" fill="#CFF6DE" stroke="#0B0D0C" strokeWidth="5" />
        <path d="M120 214v7M130 216v7M140 214v7" stroke="#0B0D0C" strokeWidth="5" strokeLinecap="round" />
        {/* legs */}
        <rect x="72" y="200" width="18" height="26" rx="6" fill="#22D46B" stroke="#0B0D0C" strokeWidth="5" />
        <rect x="170" y="200" width="18" height="26" rx="6" fill="#22D46B" stroke="#0B0D0C" strokeWidth="5" />

        {/* ears, drooping out to the sides */}
        <ellipse cx="64" cy="86" rx="22" ry="11" fill="#00B84D" stroke="#0B0D0C" strokeWidth="5" transform="rotate(-18 64 86)" />
        <ellipse cx="196" cy="86" rx="22" ry="11" fill="#00B84D" stroke="#0B0D0C" strokeWidth="5" transform="rotate(18 196 86)" />

        {/* head */}
        <ellipse cx="130" cy="86" rx="58" ry="50" fill="#22D46B" stroke="#0B0D0C" strokeWidth="6" />
        {/* head patch */}
        <ellipse cx="102" cy="62" rx="17" ry="13" fill="#00722F" />

        {/* horns — drawn over the head so they actually read */}
        <path
          d="M96 46C86 30 70 24 60 30c-9 6-6 20 6 24 9 3 20 0 30-8Z"
          fill="#F4F6F4"
          stroke="#0B0D0C"
          strokeWidth="5.5"
          strokeLinejoin="round"
        />
        <path
          d="M164 46c10-16 26-22 36-16 9 6 6 20-6 24-9 3-20 0-30-8Z"
          fill="#F4F6F4"
          stroke="#0B0D0C"
          strokeWidth="5.5"
          strokeLinejoin="round"
        />

        {/* eyes */}
        <circle cx="110" cy="80" r="9.5" fill="#0B0D0C" />
        <circle cx="150" cy="80" r="9.5" fill="#0B0D0C" />
        <circle cx="113" cy="76.5" r="3.2" fill="#fff" />
        <circle cx="153" cy="76.5" r="3.2" fill="#fff" />

        {/* muzzle — wide and low, the cow tell */}
        <ellipse cx="130" cy="112" rx="30" ry="19" fill="#CFF6DE" stroke="#0B0D0C" strokeWidth="5" />
        <ellipse cx="120" cy="108" rx="3.6" ry="5" fill="#0B0D0C" />
        <ellipse cx="140" cy="108" rx="3.6" ry="5" fill="#0B0D0C" />
        <path d="M122 120q8 6 16 0" stroke="#0B0D0C" strokeWidth="4" strokeLinecap="round" fill="none" />

        {/* cowbell */}
        <path d="M118 132h24" stroke="#0B0D0C" strokeWidth="5" strokeLinecap="round" />
        <path
          d="M124 134h12l4 14h-20Z"
          fill="#22D46B"
          stroke="#0B0D0C"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <circle cx="130" cy="151" r="3.4" fill="#0B0D0C" />
      </svg>
    </div>
  );
}

/** Small mark for the nav and favicon-adjacent spots. */
export function CowMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="8" cy="20" rx="6.5" ry="3.6" fill="#00B84D" stroke="#0B0D0C" strokeWidth="2.4" transform="rotate(-18 8 20)" />
      <ellipse cx="40" cy="20" rx="6.5" ry="3.6" fill="#00B84D" stroke="#0B0D0C" strokeWidth="2.4" transform="rotate(18 40 20)" />
      <ellipse cx="24" cy="26" rx="16" ry="14" fill="#22D46B" stroke="#0B0D0C" strokeWidth="2.8" />
      <ellipse cx="16" cy="19" rx="5" ry="4" fill="#00722F" />
      <path d="M14 12C11 7 6 5 3 7c-3 2-2 6 2 7 3 1 6 0 9-2Z" fill="#F4F6F4" stroke="#0B0D0C" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M34 12c3-5 8-7 11-5 3 2 2 6-2 7-3 1-6 0-9-2Z" fill="#F4F6F4" stroke="#0B0D0C" strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="18.5" cy="24" r="2.6" fill="#0B0D0C" />
      <circle cx="29.5" cy="24" r="2.6" fill="#0B0D0C" />
      <ellipse cx="24" cy="34" rx="9" ry="5.4" fill="#CFF6DE" stroke="#0B0D0C" strokeWidth="2.4" />
      <ellipse cx="21" cy="33" rx="1.3" ry="1.8" fill="#0B0D0C" />
      <ellipse cx="27" cy="33" rx="1.3" ry="1.8" fill="#0B0D0C" />
    </svg>
  );
}
