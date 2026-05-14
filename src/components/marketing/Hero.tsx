import Link from 'next/link'
import { buttonStyles } from '../ui/Button'

export default function Hero() {
  return (
    <section className="px-6 md:px-12 py-20 md:py-28 bg-paper relative overflow-hidden">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-10 md:gap-16 items-start">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-6 flex items-center gap-2">
            <span className="w-6 h-px bg-ink" aria-hidden />
            Market structure analysis · Residential GCs
          </div>
          <h1 className="font-serif text-[40px] md:text-[60px] leading-[1.04] font-semibold tracking-tight mb-7">
            Most residential work goes to a handful of LLCs. <em className="not-italic"><span className="italic text-accent">We name them.</span></em>
          </h1>
          <p className="font-mono text-[14px] leading-relaxed text-ink max-w-[560px] mb-9">
            Guessing where to compete is expensive. We pull a year of permit data for your
            city, run AI-augmented analysis on owner concentration, project type, and decision
            structure — then ship you a PDF that says exactly who to talk to and why.
          </p>
          <div className="flex flex-wrap gap-3 mb-8">
            <Link href="/pricing" className={buttonStyles('accent')} data-testid="home-hero-cta">
              See the SJ report → $349
            </Link>
            <Link href="/sample" className={buttonStyles('outline')}>
              See a sample
            </Link>
          </div>
          <div className="font-mono text-[11px] text-muted flex flex-wrap gap-4">
            <span><span className="text-ink mr-1">✓</span>Instant PDF download</span>
            <span><span className="text-ink mr-1">✓</span>7-day refund, no questions</span>
            <span><span className="text-ink mr-1">✓</span>Custom city research available</span>
          </div>
        </div>

        <div className="hidden md:block relative mt-3" aria-hidden>
          <div className="border border-ink bg-paper p-6 shadow-[8px_8px_0_var(--color-grey-200)]">
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-3">
              Schematic · ownership concentration
            </div>
            <div className="space-y-2">
              <OwnerRow name="Owner A — LLC" width="100%" />
              <OwnerRow name="Owner B — LLC" width="78%" />
              <OwnerRow name="Owner C — LLC" width="52%" />
              <OwnerRow name="Owner D — LLC" width="32%" />
              <OwnerRow name="Owner E" width="24%" />
              <OwnerRow name="Owner F" width="20%" />
              <div className="pt-2 mt-2 border-t border-grey-300 flex items-baseline justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">Top owners</span>
                <span className="font-serif text-[28px] font-semibold leading-none">most of it</span>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-dashed border-grey-300 font-mono text-[10px] text-muted italic">
              Schematic only. The paid report names every LLC, with unit count and per-tier playbook.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Schematic owner rows — no real names, no real percentages. The paid report
// is what ships the actual LLC names + unit counts. Bar widths are illustrative
// of a generic long-tail concentration shape.
function OwnerRow({ name, width }: { name: string; width: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px]">
      <div className="flex-1 grid grid-cols-[1fr_auto] gap-2 items-center">
        <span className="truncate text-muted">{name}</span>
        <span className="text-muted tracking-[0.1em]" aria-hidden>██</span>
      </div>
      <div className="w-20 h-2 bg-grey-100 relative">
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width }} />
      </div>
      <span className="w-8 text-right text-muted" aria-hidden>—</span>
    </div>
  )
}
