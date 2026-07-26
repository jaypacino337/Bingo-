import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep forest — the dark sections and the game hall.
        forest: {
          950: '#04140C',
          900: '#071C11',
          800: '#0A2617',
          700: '#0E3220',
          600: '#14432B',
          500: '#1B5637',
        },
        // The brand green.
        pump: {
          100: '#DCFCE9',
          200: '#B6F5D0',
          300: '#86EFAC',
          400: '#5BE49B',
          500: '#24C37A',
          600: '#16A362',
          700: '#0F7D4A',
        },
        // Light sections.
        mint: {
          50: '#F3FBF6',
          100: '#E7F7EE',
          200: '#D6F0E1',
        },
        ink: '#0A0F0C',
      },
      fontFamily: {
        sans: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        label: '0.18em',
      },
      boxShadow: {
        card: '0 24px 60px -28px rgba(4, 20, 12, 0.55)',
        lift: '0 2px 0 0 #0A2617',
      },
      keyframes: {
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'ball-in': {
          '0%': { transform: 'scale(0.3) translateY(24px)', opacity: '0' },
          '60%': { transform: 'scale(1.14) translateY(0)', opacity: '1' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
        'pop-in': {
          '0%': { transform: 'scale(0.82)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'daub-in': {
          '0%': { transform: 'scale(0.2)', opacity: '0' },
          '70%': { transform: 'scale(1.25)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        'ball-in': 'ball-in 420ms cubic-bezier(0.2, 0.9, 0.3, 1.4) both',
        'pop-in': 'pop-in 260ms cubic-bezier(0.2, 0.9, 0.3, 1.3) both',
        'daub-in': 'daub-in 340ms cubic-bezier(0.2, 0.9, 0.3, 1.5) both',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
