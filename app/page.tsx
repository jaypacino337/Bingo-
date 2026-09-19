import { FinalCta } from '@/components/FinalCta';
import { Footer } from '@/components/Footer';
import { Hero } from '@/components/Hero';
import { CycleTimeline } from '@/components/CycleTimeline';
import { MissedMove } from '@/components/MissedMove';
import { Nav } from '@/components/Nav';
import { Receipts } from '@/components/Receipts';
import { Thesis } from '@/components/Thesis';
import { Ticker } from '@/components/Ticker';
import { WhyNow } from '@/components/WhyNow';

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <CycleTimeline />
        <MissedMove />
        <Receipts />
        <Thesis />
        <WhyNow />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
