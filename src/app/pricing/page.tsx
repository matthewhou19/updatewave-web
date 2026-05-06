import { PRICING_TIERS, type PricingTier } from '@/lib/pricing'

/**
 * /pricing — public pricing comparison page (no hash required).
 *
 * Per design Locked Decision #19: single-column vertical ladder, max-w-3xl.
 * Tiers stacked top-to-bottom in `order` ascending: $25 reveal → $349 SJ
 * report → $1,999 research. NO "Recommended" badge — the ladder reading
 * order IS the recommendation.
 *
 * Anti-slop guardrails per Locked Decision #24: no badges, no icons in
 * colored circles, no decorative checkmark icons, no accent color outside
 * CTAs and the eyebrow.
 *
 * CTA routing: each tier's CTA links to /login with a `next` query param
 * carrying the tier-specific destination (using the `{hash}` placeholder
 * from pricing.ts ctaPathTemplate). After magic-link login, /auth/callback
 * substitutes the new user's hash and redirects them to the right page.
 * This replaces the v1 mailto fallback now that anonymous self-serve
 * signup is wired up.
 *
 * ISR: 1-hour cache. Page content is static (reads pricing.ts which is a
 * config file that only changes when we ship new pricing).
 */
export const revalidate = 3600

export default function PricingPage() {
  // Defensive copy + sort by `order` so we don't depend on the array order
  // in pricing.ts (the test asserts unique orders, not array index).
  const tiers = [...PRICING_TIERS].sort((a, b) => a.order - b.order)

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* Hero */}
        <section className="mb-10" data-testid="pricing-hero">
          <p className="text-xs uppercase tracking-wider font-semibold text-[#2563eb] mb-2">
            Plans
          </p>
          <h1 className="text-[32px] font-bold text-[#111827] leading-tight mb-4">
            Three ways to find your next project
          </h1>
          <p className="text-base text-[#374151] leading-relaxed">
            Start with $25-per-lead reveals if you want zero commitment. Buy a
            $349 city report if you want the structural picture for San Jose
            today. Pay $1,999 if you want a custom research PDF for the city
            you actually work in, plus 90 days of weekly permit monitoring on
            top.
          </p>
        </section>

        {/* Tier ladder */}
        <section data-testid="pricing-tiers">
          {tiers.map((tier, index) => (
            <TierRow
              key={tier.slug}
              tier={tier}
              isFirst={index === 0}
            />
          ))}
        </section>
      </main>

      <footer className="border-t border-gray-200 max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All data sourced from public planning commission filings.
        </p>
        <p className="text-xs text-[#9ca3af] mt-2">
          Questions?{' '}
          <a
            href="mailto:matthew@updatewave.com"
            className="hover:text-[#6b7280] underline"
          >
            matthew@updatewave.com
          </a>
        </p>
      </footer>
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
      className={`py-8 ${isFirst ? '' : 'border-t border-gray-200'}`}
    >
      <p className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-2">
        {tier.title}
      </p>

      <div className="flex items-baseline gap-3 flex-wrap mb-3">
        {showAnchor && (
          <span
            className="text-base text-[#9ca3af] line-through tabular-nums"
            data-testid={`pricing-anchor-${tier.slug}`}
          >
            {tier.anchorDisplay}
          </span>
        )}
        <span
          className="text-[28px] font-bold text-[#111827] tabular-nums"
          data-testid={`pricing-price-${tier.slug}`}
        >
          {tier.priceDisplay}
        </span>
      </div>

      <p className="text-base text-[#374151] leading-relaxed mb-4">
        {tier.subtitle}
      </p>

      <ul className="space-y-2 mb-5">
        {tier.features.map((feature, i) => (
          <li
            key={i}
            className="text-sm text-[#374151] leading-relaxed"
          >
            {feature}
          </li>
        ))}
      </ul>

      <div className="flex sm:justify-end">
        <a
          href={ctaHref}
          data-testid={`pricing-cta-${tier.slug}`}
          className="inline-flex items-center justify-center px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-md transition-colors min-h-[40px]"
        >
          {tier.ctaText}
        </a>
      </div>
    </article>
  )
}

/**
 * Build the signup-redirect href for a tier's CTA.
 *
 * Routes the visitor to /login with `next` set to the tier's ctaPathTemplate
 * (e.g. `/list/{hash}/sj`). The `{hash}` token is left literal — /auth/callback
 * substitutes it with the freshly-resolved user.hash after magic-link login
 * so first-time signups land directly on the page they were shopping for.
 */
function signupHrefForTier(tier: PricingTier): string {
  return `/login?next=${encodeURIComponent(tier.ctaPathTemplate)}`
}
