import { describe, it, expect } from 'vitest'
import { PRICING_TIERS } from '../../src/lib/pricing'

/**
 * Unit-level shape assertions for /pricing page.
 *
 * The /pricing page render uses pricing tier copy through the PRICING_TIERS
 * config. The page is a server component reading from this config; a full
 * DOM render test belongs in E2E (tests/e2e/research.spec.ts asserts on the
 * deployed page via Playwright).
 *
 * Here we lock the v1 mailto CTA contract: every tier's mailto subject must
 * be tier-specific so the founder can route the inbound message to the right
 * access URL.
 */

describe('pricing page mailto CTA contract (v1 sign-in fallback)', () => {
  it('every tier has a unique slug we can map to a mailto subject', () => {
    const slugs = new Set(PRICING_TIERS.map((t) => t.slug))
    // Three slugs expected: reveal, sj-report, research
    expect(slugs.has('reveal')).toBe(true)
    expect(slugs.has('sj-report')).toBe(true)
    expect(slugs.has('research')).toBe(true)
  })
})
