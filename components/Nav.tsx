'use client';

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
          <Mark />
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

/** A line breaking out of a flat base — the whole story in 20px. */
function Mark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect width="48" height="48" rx="10" fill="#0D1112" />
      <path
        d="M6 34 L15 27 L22 30 L31 17 L38 21 L42 11"
        fill="none"
        stroke="#19FB7B"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="11" r="3.6" fill="#19FB7B" />
      <rect x="6" y="39" width="36" height="2.6" rx="1.3" fill="#1E2627" />
    </svg>
  );
}
