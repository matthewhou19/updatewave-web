import Link from 'next/link'
import { PRICING_TIERS, type PricingTier } from '@/lib/pricing'
import { buttonStyles } from '../ui/Button'

const FEATURED_SLUG = 'sj-report'
// Per-lead reveals ($199) are intentionally hidden from the homepage tease —
// the brand pitch is market analysis, not pay-per-lead. The full /pricing page
// still lists them for transparency and existing customers.
const HOMEPAGE_TIERS: ReadonlyArray<PricingTier['slug']> = ['sj-report', 'research']

function ctaHref(tier: PricingTier): string {
  return `/login?next=${encodeURIComponent(tier.ctaPathTemplate)}`
}

export default function PricingTease() {
  const tiers = PRICING_TIERS.filter((t) => HOMEPAGE_TIERS.includes(t.slug)).sort(
    (a, b) => a.order - b.order
  )

  return (
    <section id="pricing" className="bg-grey-100 border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            Two ways in. Same analysis underneath.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3 max-w-[640px]">
            Start with San Jose for $499 (instant). Or commission the same analysis for any Bay
            Area city, plus 90 days of weekly permit monitoring, for $1,999.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 max-w-[900px] mx-auto">
          {tiers.map((tier) => {
            const featured = tier.slug === FEATURED_SLUG
            return (
              <article
                key={tier.slug}
                className={`relative border border-ink p-7 ${featured ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}
              >
                {featured && (
                  <span className="absolute -top-2.5 left-6 bg-accent text-paper font-mono text-[10px] px-2 py-0.5 tracking-[0.1em] uppercase">
                    Start here
                  </span>
                )}
                <div className="font-mono text-[11px] tracking-[0.15em] uppercase mb-4 opacity-70">
                  {tier.title}
                </div>
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="font-serif text-[44px] md:text-[48px] font-semibold leading-none tabular-nums tracking-tight">
                    {tier.priceDisplay}
                  </span>
                </div>
                {tier.anchorDisplay && (
                  <div className="font-mono text-[11px] line-through opacity-60 mb-2 tabular-nums">
                    {tier.anchorDisplay}
                  </div>
                )}
                <p className="font-mono text-[12px] mb-6 opacity-85 leading-relaxed">{tier.subtitle}</p>
                <ul className="list-none mb-8">
                  {tier.features.map((f, i) => (
                    <li
                      key={i}
                      className={`font-mono text-[12px] py-1.5 opacity-85 ${i === tier.features.length - 1 ? '' : 'border-b border-current/20'}`}
                    >
                      <span className="opacity-60 mr-1">—</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={ctaHref(tier)}
                  className={`${featured ? buttonStyles('outline') + ' !border-paper !text-paper hover:!bg-paper hover:!text-ink' : buttonStyles('primary')} block w-full`}
                >
                  {tier.ctaText}
                </Link>
              </article>
            )
          })}
        </div>

        <div className="text-center mt-8">
          <Link href="/pricing" className="font-mono text-[12px] text-muted underline hover:text-ink">
            See full pricing (incl. pay-per-lead reveals) →
          </Link>
        </div>
      </div>
    </section>
  )
}
