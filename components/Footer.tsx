import { shortMint, site } from '@/lib/site';

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 sm:flex-row sm:justify-between">
        <span className="text-[14px] font-black uppercase tracking-tight">{site.name}</span>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {site.twitter ? (
            <a
              href={site.twitter}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-label text-muted transition-colors hover:text-up"
            >
              X
            </a>
          ) : null}
          {site.telegram ? (
            <a
              href={site.telegram}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] uppercase tracking-label text-muted transition-colors hover:text-up"
            >
              Telegram
            </a>
          ) : null}
          <span className="font-mono text-[10px] uppercase tracking-label text-muted/70">
            {shortMint()}
          </span>
        </div>
      </div>

      <p className="mx-auto mt-6 max-w-2xl px-5 text-center font-mono text-[9.5px] uppercase leading-relaxed tracking-label text-muted/50">
        A memecoin. No utility, no roadmap, no promises. Nothing here is financial advice.
        Figures shown are illustrative — do your own research.
      </p>
    </footer>
  );
}
