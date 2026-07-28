import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? 'BINGO';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bingo.fun'),
  title: {
    default: 'Bingo.fun — Everyone fights. One walks out.',
    template: '%s · Bingo.fun',
  },
  description: `A duel royale on Solana. Hold $${SYMBOL} and your wallet fields fighters — one for every 1,000,000 tokens. Waves cut the arena to eight, the last eight duel head to head, and the survivor takes every creator fee earned that round.`,
  keywords: ['duel royale', 'solana', 'pump.fun', 'onchain game', 'battle royale', SYMBOL],
  openGraph: {
    title: 'Bingo.fun — Everyone fights. One walks out.',
    description: `Duel royale, on-chain. 1,000,000 $${SYMBOL} = 1 fighter. Last one standing takes the creator fees.`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bingo.fun — Everyone fights. One walks out.',
    description: `Duel royale, on-chain. 1,000,000 $${SYMBOL} = 1 fighter.`,
  },
};

export const viewport: Viewport = {
  themeColor: '#04140C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
