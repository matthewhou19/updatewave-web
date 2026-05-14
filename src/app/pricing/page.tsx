import { PRICING_TIERS, type PricingTier } from '@/lib/pricing'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import { buttonStyles } from '@/components/ui/Button'

/**
 * /pricing — public pricing comparison page (no hash required).
 *
 * Per design Locked Decision #19: single-column vertical ladder, max-w-3xl.
 * Tiers stacked top-to-bottom in `order` ascending: $199 reveal → $499 SJ
 * report → $1,999 research. NO "Recommended" badge — the ladder reading
 * order IS the recommendation.
 *
 * Anti-slop guardrails per Locked Decision #24: no badges, no icons in
 * colored circles, no decorative checkmark icons, no accent color outside
 * CTAs and the eyebrow.
 *
 * Visual design ported from the wireframe: warm-paper aesthetic, Fraunces
 * serif headings + JetBrains Mono body, hairline ink borders, square corners.
 *
 * ISR: 1-hour cache.
 */
export const revalidate = 3600

export default function PricingPage() {
  const tiers = [...PRICING_TIERS].sort((a, b) => a.order - b.order)

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />

      <main className="max-w-3xl w-full mx-auto px-6 py-12 flex-1">
        <section className="mb-12" data-testid="pricing-hero">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent mb-3">
            Plans
          </p>
          <h1 className="font-serif text-[36px] md:text-[44px] font-semibold leading-tight tracking-tight mb-5">
            Three ways to find your next project
          </h1>
          <p className="font-mono text-[13px] text-ink leading-relaxed">
            Start with $199-per-lead reveals if you want zero commitment. Buy a $499 city report if
            you want the structural picture for San Jose today. Pay $1,999 if you want a custom
            research PDF for the city you actually work in, plus 90 days of weekly permit
            monitoring on top.
          </p>
        </section>

        <section data-testid="pricing-tiers">
          {tiers.map((tier, index) => (
            <TierRow key={tier.slug} tier={tier} isFirst={index === 0} />
          ))}
        </section>
      </main>

      <Footer />
    </div>
  )
}

interface TierRowProps {
  tier: PricingTier
  isFirst: boolean
}

function TierRow({ tier, isFirst }: TierRowProps) {
  const ctaHref = signupHrefForTier(tier)
  const showAnchor = tier.anchorDisplay !== null

  return (
    <article
      data-testid={`pricing-tier-${tier.slug}`}
      className={`py-10 ${isFirst ? '' : 'border-t border-ink'}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
        {tier.title}
      </p>

      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        {showAnchor && (
          <span
            className="font-mono text-[14px] text-muted line-through tabular-nums"
            data-testid={`pricing-anchor-${tier.slug}`}
          >
            {tier.anchorDisplay}
          </span>
        )}
        <span
          className="font-serif text-[36px] md:text-[40px] font-semibold text-ink tabular-nums leading-none"
          data-testid={`pricing-price-${tier.slug}`}
        >
          {tier.priceDisplay}
        </span>
      </div>

      <p className="font-mono text-[13px] text-ink leading-relaxed mb-5">{tier.subtitle}</p>

      <ul className="mb-6 list-none">
        {tier.features.map((feature, i) => (
          <li key={i} className="font-mono text-[13px] text-ink leading-relaxed py-1">
            <span className="text-muted mr-1">—</span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="flex sm:justify-end">
        <a href={ctaHref} data-testid={`pricing-cta-${tier.slug}`} className={buttonStyles('primary')}>
          {tier.ctaText}
        </a>
      </div>
    </article>
  )
}

function signupHrefForTier(tier: PricingTier): string {
  return `/login?next=${encodeURIComponent(tier.ctaPathTemplate)}`
}
