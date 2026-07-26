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
    default: 'Bingo.fun — Eyes down. Fees up.',
    template: '%s · Bingo.fun',
  },
  description: `The classic hall game, rebuilt on Solana. Hold $${SYMBOL} to get your cards — every 1,000,000 tokens is one entry. Numbers get drawn, someone shouts house, and the winner takes every creator fee earned that game.`,
  keywords: ['bingo', 'solana', 'pump.fun', 'onchain bingo', SYMBOL],
  openGraph: {
    title: 'Bingo.fun — Eyes down. Fees up.',
    description: `Old school bingo, on-chain. 1,000,000 $${SYMBOL} = 1 card. Winner takes the creator fees.`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bingo.fun — Eyes down. Fees up.',
    description: `Old school bingo, on-chain. 1,000,000 $${SYMBOL} = 1 card.`,
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
