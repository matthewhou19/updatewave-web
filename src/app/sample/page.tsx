import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import { buttonStyles } from '@/components/ui/Button'

export const metadata = {
  title: 'Sample · SJ Market Structure Report',
  description: 'Table of contents and one redacted page from the $499 San Jose market analysis.',
}

// Public sample of the SJ report. Shows enough STRUCTURE to prove the analysis
// is real (table of contents, methodology, the analytic framework) but redacts
// every actual finding (LLC names, percentages, owner unit counts). Visitors see
// the SHAPE of what they'd buy, not the answer.

// Buy CTAs route through /login. The auth callback substitutes {hash} with the
// signed-in user's actual hash, so a brand-new visitor lands on
// /list/USER_HASH/sj (which has the BuyButton wired to Stripe). Same pattern
// as PricingTease + the /pricing page.
const SJ_REPORT_BUY_HREF = `/login?next=${encodeURIComponent('/list/{hash}/sj')}`

export default function SamplePage() {
  return (
    <div className="min-h-screen bg-paper">
      <TopBar />

      <section className="px-6 md:px-12 py-16 md:py-20 border-b border-dashed border-ink">
        <div className="max-w-[900px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-6 flex items-center gap-2">
            <span className="w-6 h-px bg-ink" aria-hidden />
            Sample preview · San Jose Market Structure Report
          </div>
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[1.05] font-semibold tracking-tight mb-7">
            What you actually get for <em className="not-italic"><span className="italic text-accent">$499</span></em>.
          </h1>
          <p className="font-mono text-[14px] leading-relaxed text-ink max-w-[640px] mb-9">
            Below is the table of contents, the analytic framework, one fully visible page
            (methodology), and one section with findings redacted. Buy the report to see the
            named LLCs, exact unit counts, and per-tier playbooks.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href={SJ_REPORT_BUY_HREF} className={buttonStyles('accent')}>
              Buy the SJ report → $499
            </Link>
            <Link href="/" className={buttonStyles('outline')}>
              ← Back to home
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-12 py-16 md:py-20 border-b border-dashed border-ink">
        <div className="max-w-[900px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            01 · Table of contents
          </div>
          <h2 className="font-serif text-[28px] md:text-[36px] leading-tight font-semibold tracking-tight mb-8">
            How the report is organized.
          </h2>
          <ol className="border-t border-ink">
            <TocRow num="00" title="Three-tier overview" sub="ADU vs SFR vs Multifamily — the structural framing" />
            <TocRow num="01" title="ADU tier" sub="Quantity + trend, project sizes, geographic hotspots, owner concentration, frequent players, GC playbook" />
            <TocRow num="02" title="SFR tier" sub="Project sizes, geographic hotspots, owner LLCs (named), GC playbook" />
            <TocRow num="03" title="Multifamily tier" sub="Apartment + Townhouse, geographic distribution, owner concentration (named), GC playbook" />
            <TocRow num="04" title="Data caveats" sub="What we did and didn't measure" />
          </ol>
        </div>
      </section>

      <section className="bg-grey-100 border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-[900px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            02 · Analytic framework (full preview)
          </div>
          <h2 className="font-serif text-[28px] md:text-[36px] leading-tight font-semibold tracking-tight mb-6">
            The three tiers — why they need three different playbooks.
          </h2>

          <p className="font-mono text-[13px] leading-relaxed text-ink max-w-[700px] mb-8">
            Every residential permit in San Jose lands in one of three tiers. The tiers differ
            in size, owner type, and decision structure — which means the GC outreach motion
            for each is different. The report opens with this framing, then drills into each
            tier one at a time.
          </p>

          <TierBlock
            tag="MULTIFAMILY"
            tagColor="bg-ink"
            name="Apartment + Townhouse"
            character="Developer-owned. Top 5 hold most. Pure relationship sales."
          />
          <TierBlock
            tag="SFR"
            tagColor="bg-accent"
            name="Single-Family Residence"
            character="Looks like a free market. Isn't. A small group of LLCs hold most of it."
          />
          <TierBlock
            tag="ADU"
            tagColor="bg-ink"
            name="Accessory Dwelling Unit"
            character="Atomic B2C market. One owner = one ADU. No channel leverage. SEO + neighbourhood reputation wins."
          />

          <p className="font-mono text-[12px] text-muted mt-8 italic">
            Above is the FULL framing as it appears in the report. The next sections in the
            paid report drill into each tier with named LLCs, unit counts, zip-code hotspots,
            and per-tier outreach playbooks.
          </p>
        </div>
      </section>

      <section className="px-6 md:px-12 py-16 md:py-20 border-b border-dashed border-ink">
        <div className="max-w-[900px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            03 · SFR section (findings redacted)
          </div>
          <h2 className="font-serif text-[28px] md:text-[36px] leading-tight font-semibold tracking-tight mb-6">
            Sample: how an owner-concentration table is structured.
          </h2>

          <p className="font-mono text-[13px] leading-relaxed text-ink max-w-[700px] mb-8">
            Below is the actual layout of the SFR section&apos;s owner concentration table. The
            shape is real. The names and counts are redacted because they&apos;re the answer the
            $499 report is selling.
          </p>

          <div className="border border-ink">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 p-4 bg-ink text-paper font-serif text-[14px] font-semibold">
              <span>Owner LLC</span>
              <span className="text-right">SFR units</span>
              <span className="text-right">Total sqft</span>
            </div>
            <RedactedRow />
            <RedactedRow />
            <RedactedRow />
            <RedactedRow />
            <RedactedRow />
            <RedactedRow last />
            <div className="border-t border-ink p-4 bg-grey-100 font-mono text-[12px] text-ink">
              <span className="font-semibold">Top 6 LLCs hold</span>
              <span className="ml-3 inline-block bg-grey-300 text-transparent px-3 select-none rounded-sm">XX%</span>
              <span className="ml-3">of San Jose SFR.</span>
            </div>
          </div>

          <p className="font-mono text-[12px] text-muted mt-6 italic">
            The buy unlocks: real LLC names, exact unit counts, total square footage per owner,
            and the per-LLC GC playbook.
          </p>
        </div>
      </section>

      <section className="bg-grey-100 px-6 md:px-12 py-16 md:py-20 border-b border-dashed border-ink">
        <div className="max-w-[900px] mx-auto">
          <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            04 · Data caveats (full preview)
          </div>
          <h2 className="font-serif text-[28px] md:text-[36px] leading-tight font-semibold tracking-tight mb-6">
            What we measured. And what we didn&apos;t.
          </h2>
          <ol className="space-y-4 font-mono text-[13px] leading-relaxed text-ink list-decimal pl-6">
            <li>
              The report excludes self-reported construction value: owners systematically
              under-report. We measure all project sizes in square footage instead — closer
              to what a GC actually quotes against.
            </li>
            <li>
              We don&apos;t track project completion dates. So no claims about cycle time,
              delays, or profit windows.
            </li>
            <li>
              Data window closes at the start of the most recent quarter. The current quarter
              is incomplete and excluded.
            </li>
          </ol>
        </div>
      </section>

      <section className="bg-ink text-paper px-6 md:px-12 py-20 md:py-24 text-center border-b border-dashed border-paper/30">
        <h2 className="font-serif text-[36px] md:text-[48px] font-semibold leading-[1.05] tracking-tight max-w-[700px] mx-auto mb-6">
          Stop guessing. <em className="not-italic"><span className="italic text-accent">Get the names.</span></em>
        </h2>
        <p className="font-mono text-[14px] opacity-70 mb-8">
          $499. Instant download. 7-day refund.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link href={SJ_REPORT_BUY_HREF} className={buttonStyles('accent')}>
            Buy the SJ report →
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}

function TocRow({ num, title, sub }: { num: string; title: string; sub: string }) {
  return (
    <li className="grid grid-cols-[40px_1fr] gap-4 py-5 border-b border-ink list-none">
      <span className="font-mono text-[11px] text-muted pt-1">{num}</span>
      <div>
        <div className="font-serif text-[18px] md:text-[20px] font-semibold tracking-tight">{title}</div>
        <p className="font-mono text-[12px] text-muted mt-1">{sub}</p>
      </div>
    </li>
  )
}

function TierBlock({
  tag,
  tagColor,
  name,
  character,
}: {
  tag: string
  tagColor: string
  name: string
  character: string
}) {
  return (
    <div className="border border-ink bg-paper p-5 mb-3">
      <div className="flex items-baseline gap-3 flex-wrap mb-2">
        <span className={`${tagColor} text-paper font-mono text-[10px] px-2 py-1 tracking-[0.1em] uppercase`}>
          {tag}
        </span>
        <span className="font-serif text-[18px] font-semibold">{name}</span>
      </div>
      <p className="font-mono text-[12px] text-ink leading-relaxed">{character}</p>
    </div>
  )
}

function RedactedRow({ last = false }: { last?: boolean }) {
  return (
    <div className={`grid grid-cols-[1fr_auto_auto] gap-4 p-4 ${last ? '' : 'border-b border-grey-300'} font-mono text-[12px] items-center`}>
      <span className="bg-grey-200 text-transparent px-3 py-1 select-none rounded-sm w-fit">REDACTED LLC NAME</span>
      <span className="bg-grey-200 text-transparent px-3 py-1 select-none rounded-sm tabular-nums">XX</span>
      <span className="bg-grey-200 text-transparent px-3 py-1 select-none rounded-sm tabular-nums">XX,XXX</span>
    </div>
  )
}
