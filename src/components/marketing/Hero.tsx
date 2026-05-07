import { buttonStyles } from '../ui/Button'

export default function Hero() {
  return (
    <section className="px-6 md:px-12 py-20 md:py-28 bg-paper relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10 md:gap-16 items-start">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-6 flex items-center gap-2">
            <span className="w-6 h-px bg-ink" aria-hidden />
            Pre-permit residential leads · San Jose
          </div>
          <h1 className="font-serif text-[40px] md:text-[64px] leading-[1.02] font-semibold tracking-tight mb-7">
            Win residential bids <em className="not-italic"><span className="italic text-accent">30 to 60 days</span></em> before your competitors know they exist.
          </h1>
          <p className="font-mono text-[14px] leading-relaxed text-ink max-w-[520px] mb-9">
            UpdateWave surfaces homeowners the moment they file plans with the city — months before
            permits are issued, before architects pitch their GC network. Sourced directly from
            public planning records.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            <a href="#listings" className={buttonStyles('accent')} data-testid="home-hero-cta">
              Browse free →
            </a>
            <a href="#how" className={buttonStyles('outline')}>
              See how it works
            </a>
          </div>
          <div className="font-mono text-[11px] text-muted flex flex-wrap gap-4">
            <span><span className="text-ink mr-1">✓</span>Updated daily</span>
            <span><span className="text-ink mr-1">✓</span>No subscription</span>
            <span><span className="text-ink mr-1">✓</span>Refund on bad data</span>
          </div>
        </div>

        <div className="hidden md:block aspect-[4/5] relative mt-3" aria-hidden>
          <div className="absolute inset-0">
            <div className="absolute top-0 right-4 w-[85%] h-[180px] border border-ink bg-paper p-4 rotate-[-2deg] shadow-[8px_8px_0_var(--color-grey-200)]">
              <div className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">
                <span className="text-accent">●●●</span> FILED 4H AGO · SJ 95126
              </div>
              <div className="font-serif text-[20px] font-semibold mb-2">
                <span className="bg-grey-200 text-transparent px-1.5">XXX</span> 13th St
              </div>
              <div className="font-mono text-[11px] text-ink">
                749 sq ft detached ADU · 2BR / 2BA
              </div>
            </div>
            <div className="absolute top-[200px] right-0 w-[85%] h-[180px] border border-ink bg-paper p-4 rotate-[1deg] shadow-[8px_8px_0_var(--color-grey-200)]">
              <div className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">
                <span className="text-accent">●●●●</span> FILED YESTERDAY · SJ 95124
              </div>
              <div className="font-serif text-[20px] font-semibold mb-2">
                <span className="bg-grey-200 text-transparent px-1.5">XX</span> Oak Knoll Dr
              </div>
              <div className="font-mono text-[11px] text-ink">
                2,220 sq ft remodel + 748 sq ft ADU
              </div>
            </div>
            <div className="absolute top-[400px] right-6 w-[85%] h-[180px] border border-ink bg-paper p-4 rotate-[-1deg] shadow-[8px_8px_0_var(--color-grey-200)]">
              <div className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1">
                <span className="text-accent">●●●</span> FILED 3D AGO · SJ 95129
              </div>
              <div className="font-serif text-[20px] font-semibold mb-2">
                <span className="bg-grey-200 text-transparent px-1.5">XXX</span> Colleen Dr
              </div>
              <div className="font-mono text-[11px] text-ink">
                4,182 sq ft 2-story SFD · est. $2.1M
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
