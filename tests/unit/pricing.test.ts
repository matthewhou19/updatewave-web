import { describe, it, expect } from 'vitest'
import { PRICING_TIERS, type PricingTier } from '../../src/lib/pricing'

/**
 * Drift assertions for the pricing tier config.
 *
 * The reviewer correctly flagged (design "Reviewer Concerns / pricing.ts source
 * of truth") that priceCents is the numeric truth used at Stripe checkout time,
 * while priceDisplay is the rendered string. These two MUST stay aligned. The
 * critical drift is between PRICING_TIERS.sj-report.priceCents and the
 * city_lists seed value (34900) — if they diverge, the comparison page shows
 * one price and the actual checkout charges a different amount.
 *
 * The seed value lives in:
 *   supabase/migrations/002-city-lists-and-list-purchases.sql (price_cents=34900)
 */

describe('PRICING_TIERS structure', () => {
  it('contains exactly 3 tiers (reveal, sj-report, research)', () => {
    expect(PRICING_TIERS).toHaveLength(3)
    const slugs = PRICING_TIERS.map((t) => t.slug).sort()
    expect(slugs).toEqual(['research', 'reveal', 'sj-report'])
  })

  it('each tier has the required PricingTier shape', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier).toMatchObject<Partial<PricingTier>>({
        slug: expect.any(String),
        order: expect.any(Number),
        title: expect.any(String),
        subtitle: expect.any(String),
        priceDisplay: expect.any(String),
        ctaText: expect.any(String),
        ctaPathTemplate: expect.any(String),
      })
      expect(Array.isArray(tier.features)).toBe(true)
      expect(tier.features.length).toBeGreaterThanOrEqual(2)
      expect(tier.features.length).toBeLessThanOrEqual(3)
    }
  })

  it('orders tiers from cheapest entry to anchor (reveal=1, sj-report=2, research=3)', () => {
    const byOrder = [...PRICING_TIERS].sort((a, b) => a.order - b.order)
    expect(byOrder.map((t) => t.slug)).toEqual(['reveal', 'sj-report', 'research'])
  })

  it('has unique order values', () => {
    const orders = PRICING_TIERS.map((t) => t.order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('has unique slugs', () => {
    const slugs = PRICING_TIERS.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every CTA template uses the {hash} placeholder convention or a hashless route', () => {
    // Per Locked Decision #15, hashless visitors are routed through the sign-in
    // flow at render time. The template either contains {hash} or is a public
    // route. Fail loudly on anything else (typo, hardcoded hash).
    for (const tier of PRICING_TIERS) {
      const containsHash = tier.ctaPathTemplate.includes('{hash}')
      const isPublicSignup = tier.ctaPathTemplate.startsWith('/signup')
      expect(
        containsHash || isPublicSignup,
        `tier ${tier.slug} ctaPathTemplate must contain {hash} or be /signup-prefixed`
      ).toBe(true)
    }
  })
})

describe('PRICING_TIERS drift assertions (CRITICAL)', () => {
  it('sj-report.priceCents === 34900 (matches city_lists seed in migration 002)', () => {
    const sj = PRICING_TIERS.find((t) => t.slug === 'sj-report')
    expect(sj).toBeDefined()
    // This is the load-bearing assertion. If this fails, the comparison page
    // shows a price that does not match the city_lists row, and Stripe charges
    // an amount that doesn't match what the customer was shown. DO NOT loosen
    // this without updating BOTH the seed and the pricing config in lockstep.
    expect(sj!.priceCents).toBe(34900)
  })

  it('sj-report.priceDisplay matches priceCents formatting ($349)', () => {
    const sj = PRICING_TIERS.find((t) => t.slug === 'sj-report')!
    expect(sj.priceDisplay).toBe('$349')
  })

  it('sj-report.anchorDisplay === "$499" (matches city_lists.anchor_price_cents=49900)', () => {
    const sj = PRICING_TIERS.find((t) => t.slug === 'sj-report')!
    expect(sj.anchorDisplay).toBe('$499')
  })

  it('research.priceCents === 199900 ($1,999 anchor)', () => {
    const research = PRICING_TIERS.find((t) => t.slug === 'research')!
    expect(research.priceCents).toBe(199900)
  })

  it('research.priceDisplay === "$1,999" (with comma per design spec)', () => {
    const research = PRICING_TIERS.find((t) => t.slug === 'research')!
    // Design doc: "$1999 priceDisplay is '$1,999'"
    expect(research.priceDisplay).toBe('$1,999')
  })

  it('reveal.priceCents is null (usage-based pricing, not a one-time SKU)', () => {
    const reveal = PRICING_TIERS.find((t) => t.slug === 'reveal')!
    expect(reveal.priceCents).toBeNull()
  })

  it('reveal.priceDisplay communicates per-unit pricing (per design OQ#6)', () => {
    const reveal = PRICING_TIERS.find((t) => t.slug === 'reveal')!
    // Design proposal: "$25 each · pay per architect contact" — the key
    // signal is that the string includes "$25" so customers see the per-unit price.
    expect(reveal.priceDisplay).toContain('$25')
  })

  it('research has no anchorDisplay (it IS the anchor; no further anchor above it)', () => {
    const research = PRICING_TIERS.find((t) => t.slug === 'research')!
    expect(research.anchorDisplay).toBeNull()
  })
})

describe('PRICING_TIERS routing', () => {
  it('reveal CTA routes to /browse/{hash} (existing flow)', () => {
    const reveal = PRICING_TIERS.find((t) => t.slug === 'reveal')!
    expect(reveal.ctaPathTemplate).toBe('/browse/{hash}')
  })

  it('sj-report CTA routes to /list/{hash}/sj (existing flow)', () => {
    const sj = PRICING_TIERS.find((t) => t.slug === 'sj-report')!
    expect(sj.ctaPathTemplate).toBe('/list/{hash}/sj')
  })

  it('research CTA routes to /research/{hash} (new Lane C flow)', () => {
    const research = PRICING_TIERS.find((t) => t.slug === 'research')!
    expect(research.ctaPathTemplate).toBe('/research/{hash}')
  })
})
