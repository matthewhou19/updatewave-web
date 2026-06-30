import { describe, it, expect, afterEach } from 'vitest'
import { resolveBaseUrl } from '../../src/lib/site-url'

/**
 * Regression guard for the 2026-06-19 checkout outage.
 *
 * A non-ASCII character baked into NEXT_PUBLIC_BASE_URL made every Stripe
 * checkout 500 (success_url url_invalid). resolveBaseUrl() must never return a
 * non-ASCII origin, so a malformed env value can't break checkout again.
 */
describe('resolveBaseUrl', () => {
  const original = { ...process.env }

  afterEach(() => {
    process.env = { ...original }
  })

  it('returns a clean NEXT_PUBLIC_BASE_URL unchanged', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.updatewave.org'
    delete process.env.VERCEL_URL
    expect(resolveBaseUrl()).toBe('https://www.updatewave.org')
  })

  it('trims surrounding whitespace and newlines', () => {
    process.env.NEXT_PUBLIC_BASE_URL = '  https://www.updatewave.org\n'
    delete process.env.VERCEL_URL
    expect(resolveBaseUrl()).toBe('https://www.updatewave.org')
  })

  it('drops a trailing slash via URL.origin normalization', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.updatewave.org/'
    delete process.env.VERCEL_URL
    expect(resolveBaseUrl()).toBe('https://www.updatewave.org')
  })

  it('never returns a non-ASCII origin (the outage case)', () => {
    // zero-width space — NOT removed by trim(); must be neutralized downstream.
    process.env.NEXT_PUBLIC_BASE_URL = 'https://www.updatewave.org​'
    delete process.env.VERCEL_URL
    const out = resolveBaseUrl()
    expect(/[^\x20-\x7E]/.test(out)).toBe(false)
    expect(out).toMatch(/^https:\/\/(www\.)?updatewave\.org$/)
  })

  it('falls back to canonical when the value is not a valid URL', () => {
    process.env.NEXT_PUBLIC_BASE_URL = 'not a url'
    delete process.env.VERCEL_URL
    expect(resolveBaseUrl()).toBe('https://www.updatewave.org')
  })

  it('falls back to localhost when nothing is configured', () => {
    delete process.env.NEXT_PUBLIC_BASE_URL
    expect(resolveBaseUrl()).toBe('http://localhost:3000')
  })
})
