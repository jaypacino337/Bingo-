import type { Metadata } from 'next';
import StreetClient from './StreetClient';

export const metadata: Metadata = {
  title: 'Pump Street — own a plot, pick a path',
  description:
    'A property economy on Solana. 2,000 plots. Rent to tenants, lease to a business, or run your own — with daily settlement driven by real market data.',
};

export default function StreetPage() {
  return <StreetClient />;
}
