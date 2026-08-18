import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Money green. Deliberately its own tone, not any payment app's.
        cash: {
          50: '#EAFBF0',
          100: '#CFF6DE',
          200: '#9DEDBE',
          300: '#5CE092',
          400: '#22D46B',
          500: '#00B84D',
          600: '#009840',
          700: '#00722F',
          800: '#004D20',
          900: '#002B12',
        },
        ink: '#0B0D0C',
        smoke: '#F4F6F4',
      },
      fontFamily: {
        sans: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: { label: '0.16em' },
      boxShadow: {
        lift: '0 3px 0 0 #0B0D0C',
        card: '0 24px 60px -30px rgba(11, 13, 12, 0.35)',
      },
      keyframes: {
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        'cash-fly': {
          '0%': { transform: 'translate(0,0) rotate(0deg) scale(0.6)', opacity: '0' },
          '15%': { opacity: '1' },
          '100%': { transform: 'translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(1)', opacity: '0' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        chew: {
          '0%, 100%': { transform: 'rotate(-1.5deg)' },
          '50%': { transform: 'rotate(1.5deg)' },
        },
      },
      animation: {
        'cash-fly': 'cash-fly var(--dur, 2.4s) ease-out infinite',
        'pop-in': 'pop-in 260ms cubic-bezier(0.2,0.9,0.3,1.3) both',
        chew: 'chew 3.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
