import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-mono',
  display: 'swap',
});

const TITLE = 'SIDELINED — Still sidelined?';
const DESCRIPTION =
  'The market came back. BTC bounced. SOL ripped. Meme volume returned. People called the cycle dead and stayed sidelined. SIDELINED is the token for everyone who watched the move and still didn’t click buy.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://sidelined.fun'),
  title: { default: TITLE, template: '%s · SIDELINED' },
  description: DESCRIPTION,
  keywords: ['sidelined', 'memecoin', 'solana', 'pump.fun', 'bull market', 'crypto'],
  openGraph: { title: TITLE, description: DESCRIPTION, type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export const viewport: Viewport = {
  themeColor: '#07090A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
