import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Near-black, not pure black, so glows have somewhere to sit.
        // NB: do not call this `base` — that collides with Tailwind's
        // `text-base` font-size utility and silently repaints text.
        night: '#07090A',
        panel: '#0D1112',
        raised: '#141A1B',
        line: '#1E2627',
        muted: '#7C8886',
        // Bullish green. One accent, used sparingly so it still means something.
        up: {
          DEFAULT: '#19FB7B',
          dim: '#0FCB61',
          deep: '#06703A',
          glow: 'rgba(25, 251, 123, 0.18)',
        },
        down: '#FF5A5A',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        label: '0.22em',
        tightest: '-0.045em',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        draw: { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
        rise: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.75' },
        },
        blink: { '0%, 49%': { opacity: '1' }, '50%, 100%': { opacity: '0' } },
      },
      animation: {
        marquee: 'marquee 34s linear infinite',
        'marquee-fast': 'marquee 18s linear infinite',
        rise: 'rise 600ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-glow': 'pulseGlow 3.5s ease-in-out infinite',
        blink: 'blink 1.1s step-end infinite',
      },
    },
  },
  plugins: [],
};

export default config;
