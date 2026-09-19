'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { buyUrl, shortMint, site } from '@/lib/site';

const LINKS = [
  { href: '#market', label: 'Market' },
  { href: '#lows', label: '$1,000' },
  { href: '#receipts', label: 'Receipts' },
  { href: '#thesis', label: 'Thesis' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const copy = async () => {
    if (!site.mint) return;
    try {
      await navigator.clipboard.writeText(site.mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the address is on screen anyway */
    }
  };

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-line bg-night/85 backdrop-blur-xl' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/brand/logo.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-full ring-1 ring-line"
          />
          <span className="text-[15px] font-black uppercase tracking-tight">{site.name}</span>
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-mono text-[10px] uppercase tracking-label text-muted transition-colors hover:text-up"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copy}
            title={site.mint ? 'Copy contract address' : 'Contract address coming soon'}
            className="hidden rounded-full border border-line px-3.5 py-2 font-mono text-[10px]
                       uppercase tracking-label text-muted transition-colors hover:border-up/50 hover:text-up sm:block"
          >
            {copied ? 'Copied' : shortMint()}
          </button>
          <a href={buyUrl()} target="_blank" rel="noreferrer" className="btn-primary !px-5 !py-2.5">
            Buy
          </a>
        </div>
      </nav>
    </header>
  );
}
