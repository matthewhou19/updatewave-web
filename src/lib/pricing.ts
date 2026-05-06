/**
 * Pricing tier configuration for the public /pricing comparison page.
 *
 * Hardcoded (not DB-backed) per design Locked Decision #8: 3 rows is YAGNI for
 * a `pricing_tiers` table. Revisit only if the product family grows past 5 tiers.
 *
 * `priceCents` is the numeric truth. The unit test in tests/unit/pricing.test.ts
 * asserts that the SJ tier's priceCents matches the city_lists seed value
 * (34900) so the comparison page never silently drifts from the actual Stripe
 * checkout price. See design "Reviewer Concerns / pricing.ts source of truth".
 *
 * Layout per Locked Decision #19: single-column vertical ladder (max-w-3xl),
 * tiers stacked top-to-bottom, separated by `border-t border-gray-200`. NO
 * "Recommended" badge anywhere — the ladder reading order IS the recommendation.
 *
 * Anti-slop guardrails per Locked Decision #24: no badges, no icons in colored
 * circles, no accent color outside CTAs and eyebrow, no decorative checkmarks.
 *
 * `ctaPathTemplate` uses `{hash}` as a literal placeholder. The /pricing page
 * is public, so a hashless visitor sees the CTA rewritten to the sign-up flow
 * (per Locked Decision #15 — sign-in system creates/links a hash on signup).
 */

export type PricingTierSlug = 'reveal' | 'sj-report' | 'research'

export interface PricingTier {
  slug: PricingTierSlug
  /**
   * Reading order top-to-bottom on /pricing. Lower number renders first.
   * The anchor effect depends on this ordering: $25 (entry) → $349
   * (recommended by position) → $1,999 (anchor).
   */
  order: number
  /** Eyebrow text, uppercase 12px (text-xs tracking-wider font-semibold). */
  title: string
  /** Single-line value statement under the price. */
  subtitle: string
  /** Human-readable price string, rendered with tabular-nums. */
  priceDisplay: string
  /**
   * Numeric truth in cents (matches city_lists.price_cents and Stripe
   * unit_amount where applicable). null for usage-based pricing ($25/reveal).
   */
  priceCents: number | null
  /**
   * Strikethrough anchor display (e.g. '$499'). null if no anchor.
   * Rendered in `text-[#9ca3af] line-through`.
   */
  anchorDisplay: string | null
  /**
   * 2-3 short feature bullets per design Locked Decision #19. Plain text;
   * the renderer must NOT prepend checkmark icons (anti-slop #24).
   */
  features: string[]
  /** CTA button text (Button-CTA-blue or Button-primary). */
  ctaText: string
  /**
   * CTA destination. The literal token `{hash}` is replaced at render time
   * with the visitor's hash. If the visitor has no hash, the renderer routes
   * through the sign-up flow per Locked Decision #15.
   */
  ctaPathTemplate: string
}

export const PRICING_TIERS: PricingTier[] = [
  {
    slug: 'reveal',
    order: 1,
    title: 'Per-lead reveal',
    subtitle: 'Pay only for the architect contacts you actually want.',
    priceDisplay: '$25 each',
    priceCents: null,
    anchorDisplay: null,
    features: [
      'Browse pre-permit projects free',
      'Unlock architect name + contact for $25 each',
      'No subscription, no minimum',
    ],
    ctaText: 'Browse leads',
    ctaPathTemplate: '/browse/{hash}',
  },
  {
    slug: 'sj-report',
    order: 2,
    title: 'City market structure report',
    subtitle:
      'One PDF that shows you which 6 owners control 75% of San Jose SFR construction.',
    priceDisplay: '$349',
    priceCents: 34900,
    anchorDisplay: '$499',
    features: [
      '15-page PDF for San Jose 2025 (instant download)',
      '12 months of permit data, structured by tier',
      '7-day refund, no questions',
    ],
    ctaText: 'See the SJ report',
    ctaPathTemplate: '/list/{hash}/sj',
  },
  {
    slug: 'research',
    order: 3,
    title: 'Custom city research',
    subtitle:
      'Pick any Bay Area city. Same report format, plus 90 days of weekly permit monitoring.',
    priceDisplay: '$1,999',
    priceCents: 199900,
    anchorDisplay: null,
    features: [
      'Same structural analysis as the SJ report, for the city you choose',
      '5-10 day delivery for new cities; instant for SJ',
      '90 days of weekly Matthew-curated permit digests by email',
    ],
    ctaText: 'Choose a city',
    ctaPathTemplate: '/research/{hash}',
  },
]
