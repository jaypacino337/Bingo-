'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from './Logo';
import { buyUrl, site } from '@/lib/site';

const LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#entries', label: 'Entries' },
  { href: '/#the-pot', label: 'The pot' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur transition-colors ${
        scrolled ? 'border-forest-900/12' : 'border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" aria-label="Bingo.fun home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-[11px] uppercase tracking-label text-forest-900/70 transition hover:text-forest-900"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/play" className="btn-ghost hidden !px-4 !py-2.5 sm:inline-flex">
            Play live
          </Link>
          <a
            href={buyUrl()}
            target="_blank"
            rel="noreferrer"
            className="btn-primary !px-4 !py-2.5"
          >
            Buy ${site.symbol}
          </a>
        </div>
      </nav>
    </header>
  );
}
