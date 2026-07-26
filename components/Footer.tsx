import { Logo } from './Logo';
import { site } from '@/lib/site';

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t-2 border-forest-900 bg-mint-100">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row">
        <Logo />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {site.twitter ? (
            <a
              href={site.twitter}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-label text-forest-700 hover:text-forest-900"
            >
              X
            </a>
          ) : null}
          {site.telegram ? (
            <a
              href={site.telegram}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-label text-forest-700 hover:text-forest-900"
            >
              Telegram
            </a>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-label text-forest-700">
            Eyes down. Fees up. · Not financial advice · {year}
          </span>
        </div>
      </div>
    </footer>
  );
}
