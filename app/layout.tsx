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

const SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL ?? 'COW';
const MINUTES = process.env.NEXT_PUBLIC_DROP_MINUTES ?? '5';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://cashcow.fun'),
  title: {
    default: 'Cash Cow — Hold the cow. Get paid.',
    template: '%s · Cash Cow',
  },
  description: `Hold $${SYMBOL} and every ${MINUTES} minutes the cow snapshots every holder and sprays the creator fees straight into their wallets, split by how much they hold. Nothing to claim.`,
  keywords: ['cash cow', 'solana', 'pump.fun', 'memecoin', 'airdrop', 'creator fees', SYMBOL],
  openGraph: {
    title: 'Cash Cow — Hold the cow. Get paid.',
    description: `Creator fees paid to every holder every ${MINUTES} minutes. Nothing to claim.`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cash Cow — Hold the cow. Get paid.',
    description: `Creator fees paid to every holder every ${MINUTES} minutes.`,
  },
};

export const viewport: Viewport = {
  themeColor: '#22D46B',
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
