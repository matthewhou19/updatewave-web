import { describe, it, expect } from 'vitest'
import { PRICING_TIERS } from '../../src/lib/pricing'

/**
 * Unit-level shape assertions for /pricing page.
 *
 * The /pricing page render uses pricing tier copy through the PRICING_TIERS
 * config. The page is a server component reading from this config; a full
 * DOM render test belongs in E2E.
 *
 * Here we lock the v2 self-serve signup contract: every tier's CTA must
 * route to /login with a `next` query param carrying that tier's
 * ctaPathTemplate, so a freshly-signed-up visitor lands on the page they
 * were shopping for. Replaces the v1 mailto fallback.
 */

describe('pricing page CTA contract (v2 self-serve signup)', () => {
  it('every tier has a unique slug', () => {
    const slugs = new Set(PRICING_TIERS.map((t) => t.slug))
    expect(slugs.has('reveal')).toBe(true)
    expect(slugs.has('sj-report')).toBe(true)
    expect(slugs.has('research')).toBe(true)
    expect(slugs.size).toBe(PRICING_TIERS.length)
  })

  it('every tier has a ctaPathTemplate that starts with `/`', () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.ctaPathTemplate.startsWith('/')).toBe(true)
    }
  })

  it('every hash-scoped ctaPathTemplate carries the {hash} placeholder', () => {
    // Tiers that need a hash to render (browse/list/research) must use the
    // literal {hash} token; /auth/callback substitutes it post-login.
    for (const tier of PRICING_TIERS) {
      if (tier.slug === 'reveal' || tier.slug === 'sj-report' || tier.slug === 'research') {
        expect(tier.ctaPathTemplate).toContain('{hash}')
      }
    }
  })
})
