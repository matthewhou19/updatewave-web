import { HomepageStats } from '@/lib/queries'

interface Props {
  stats: HomepageStats
}

function formatCents(cents: number): string {
  if (cents >= 1_000_000_00) {
    return `$${(cents / 1_000_000_00).toFixed(1)}M`
  }
  if (cents >= 1_000_00) {
    return `$${Math.round(cents / 1_000_00)}K`
  }
  return `$${(cents / 100).toFixed(0)}`
}

export default function SocialProofStrip({ stats }: Props) {
  const { gcCount, monthlyReveals, avgValueCents } = stats
  // Fallback band if numbers are too small to show without embarrassment.
  // The brand pitch is analysis quality, not aggregator scale, so the fallback
  // leans on data provenance rather than on totals.
  const showLive = gcCount >= 10 && (monthlyReveals >= 5 || avgValueCents !== null)

  return (
    <section className="bg-ink text-paper px-6 md:px-12 py-6">
      {showLive ? (
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 items-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-60 leading-snug">
            Built on real
            <br />
            San Jose data
          </div>
          <div>
            <div className="font-serif text-[32px] font-semibold leading-none">621</div>
            <div className="font-mono text-[11px] opacity-70 mt-1">Permits in the SJ report</div>
          </div>
          <div>
            <div className="font-serif text-[32px] font-semibold leading-none">{gcCount}</div>
            <div className="font-mono text-[11px] opacity-70 mt-1">GCs onboarded</div>
          </div>
          <div>
            <div className="font-serif text-[32px] font-semibold leading-none">
              {avgValueCents ? formatCents(avgValueCents) : '—'}
            </div>
            <div className="font-mono text-[11px] opacity-70 mt-1">Avg. project value tracked</div>
          </div>
        </div>
      ) : (
        <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-center gap-6 md:gap-10 font-mono text-[12px] uppercase tracking-[0.12em]">
          <span>
            <span className="text-accent mr-2" aria-hidden>●</span>621 SJ permits analyzed
          </span>
          <span className="opacity-60">·</span>
          <span>12 months of structural data</span>
          <span className="opacity-60">·</span>
          <span>Sourced from public records</span>
        </div>
      )}
    </section>
  )
}
