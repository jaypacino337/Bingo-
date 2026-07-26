/**
 * The Bingo.fun mark: a bingo cage inside a ring, plus the wordmark.
 * Drawn inline so it stays crisp at any size and inherits the theme colour.
 */

export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="currentColor" />
      <circle cx="24" cy="24" r="22" fill="none" stroke="#04140C" strokeWidth="3" />
      {/* cage */}
      <circle cx="24" cy="24" r="12.5" fill="#F3FBF6" stroke="#04140C" strokeWidth="2.6" />
      <ellipse cx="24" cy="24" rx="5.4" ry="12.5" fill="none" stroke="#04140C" strokeWidth="2" />
      <line x1="11.5" y1="24" x2="36.5" y2="24" stroke="#04140C" strokeWidth="2" />
      {/* ball */}
      <circle cx="24" cy="24" r="4.4" fill="currentColor" stroke="#04140C" strokeWidth="2.2" />
    </svg>
  );
}

export function Logo({
  className = '',
  tone = 'dark',
}: {
  className?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-7 w-7 text-pump-400" />
      <span
        className={`text-[19px] font-extrabold tracking-tight ${
          tone === 'dark' ? 'text-ink' : 'text-white'
        }`}
      >
        Bingo<span className="text-pump-500">.fun</span>
      </span>
    </span>
  );
}
