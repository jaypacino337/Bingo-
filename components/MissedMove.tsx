import { Counter } from './Counter';
import { Reveal } from './Reveal';
import { asOf, lowsBody, lowsFooter, lowsHeadline, lowsRows, lowsStake } from '@/lib/content';
import { formatValue, multipleOf } from '@/lib/format';

/**
 * The emotional centre of the page: the same $1,000, four decisions.
 *
 * Renders as a table on desktop (scannable, comparison reads instantly) and
 * as cards on mobile, because a four-column table on a phone is unreadable.
 */
export function MissedMove() {
  const best = Math.max(...lowsRows.map((r) => multipleOf(r.entry, r.current)));

  return (
    <section id="lows" className="scroll-mt-20 border-y border-line bg-panel/40 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal>
          <p className="label mb-5">02 — If you bought the lows</p>
          <h2 className="h-section mb-5 max-w-3xl">{lowsHeadline}</h2>
          <p className="mb-12 max-w-xl text-[15px] leading-relaxed text-muted">{lowsBody}</p>
        </Reveal>

        {/* ------------------------------------------------------------- */}
        {/* Desktop table                                                  */}
        {/* ------------------------------------------------------------- */}
        <Reveal>
          <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-night/70">
                  {['Asset', 'Entry', 'Now', `$${lowsStake.toLocaleString()} became`, 'Return'].map(
                    (h, i) => (
                      <th
                        key={h}
                        className={`px-6 py-4 font-mono text-[10px] uppercase tracking-label text-muted ${
                          i === 0 ? 'text-left' : 'text-right'
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {lowsRows.map((row) => {
                  const multiple = multipleOf(row.entry, row.current);
                  const value = lowsStake * multiple;
                  const isBest = multiple === best;
                  return (
                    <tr
                      key={row.asset}
                      className="group border-t border-line transition-colors hover:bg-up/[0.035]"
                    >
                      <td className="px-6 py-5">
                        <p className="text-[15px] font-bold">{row.asset}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{row.tag}</p>
                      </td>
                      <td className="num px-6 py-5 text-right text-[14px] text-muted">
                        {formatValue(row.entry, row.format)}
                      </td>
                      <td className="num px-6 py-5 text-right text-[14px]">
                        {formatValue(row.current, row.format)}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span
                          className={`num text-[19px] font-black ${isBest ? 'text-up' : 'text-white'}`}
                        >
                          <Counter to={value} prefix="$" />
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="num inline-block rounded-full bg-up/10 px-3 py-1.5 text-[12px] font-bold text-up">
                          <Counter to={multiple} decimals={multiple < 10 ? 1 : 0} suffix="x" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex items-center justify-between gap-4 border-t border-line bg-night/70 px-6 py-4">
              <span className="font-mono text-[10px] uppercase tracking-label text-muted">
                {asOf}
              </span>
              <span className="text-[15px] font-black uppercase tracking-tight text-up">
                {lowsFooter}
              </span>
            </div>
          </div>
        </Reveal>

        {/* ------------------------------------------------------------- */}
        {/* Mobile cards                                                   */}
        {/* ------------------------------------------------------------- */}
        <div className="grid gap-3 md:hidden">
          {lowsRows.map((row, i) => {
            const multiple = multipleOf(row.entry, row.current);
            const value = lowsStake * multiple;
            const isBest = multiple === best;
            return (
              <Reveal key={row.asset} delay={i * 60}>
                <article className="card p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-bold">{row.asset}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{row.tag}</p>
                    </div>
                    <span className="num shrink-0 rounded-full bg-up/10 px-2.5 py-1 text-[11px] font-bold text-up">
                      <Counter to={multiple} decimals={multiple < 10 ? 1 : 0} suffix="x" />
                    </span>
                  </div>

                  <div className="mb-4 flex items-center gap-3 font-mono text-[12px]">
                    <span className="text-muted">{formatValue(row.entry, row.format)}</span>
                    <span className="h-[1px] flex-1 bg-line" />
                    <span>{formatValue(row.current, row.format)}</span>
                  </div>

                  <div className="flex items-baseline justify-between border-t border-line pt-3.5">
                    <span className="label-muted">
                      ${lowsStake.toLocaleString()} became
                    </span>
                    <span className={`num text-[21px] font-black ${isBest ? 'text-up' : ''}`}>
                      <Counter to={value} prefix="$" />
                    </span>
                  </div>
                </article>
              </Reveal>
            );
          })}

          <Reveal>
            <p className="pt-2 text-center text-[17px] font-black uppercase tracking-tight text-up">
              {lowsFooter}
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
