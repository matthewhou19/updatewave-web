import { test, expect } from '@playwright/test'
import { TEST_HASH } from './fixtures'

const TEST_CITY = 'sj'

/**
 * E2E for the $1,999 city research product.
 *
 * Mirrors tests/e2e/list.spec.ts. Tests skip gracefully if the test hash or
 * city_lists research seed (migration 004) are not present in the database.
 *
 * Tests cover:
 *   - landing page renders dropdown + price + insight + TOC + FAQ
 *   - invalid hash → friendly error message
 *   - clicking Configure research triggers /api/create-research-checkout
 *   - status page returns 404 for non-purchasers (no info leak)
 *   - existing /list and /browse flows still load (regression)
 *   - /pricing page is publicly accessible (no hash)
 */

test.describe('Research landing page', () => {
  test('renders hero + insight + TOC + city dropdown + price + FAQ', async ({ page }) => {
    const response = await page.goto(`/research/${TEST_HASH}`)

    if (!response || response.status() !== 200) {
      test.skip(true, 'Test user or research-tier city_lists seed not found')
      return
    }

    // Hero
    await expect(page.locator('[data-testid="research-hero"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('Custom city research')

    // Killer insight
    const insight = page.locator('[data-testid="research-insight"]')
    await expect(insight).toBeVisible()
    await expect(insight).toContainText('75%')

    // TOC
    await expect(page.locator('[data-testid="research-toc"]')).toBeVisible()

    // Price
    const price = page.locator('[data-testid="launch-price"]')
    await expect(price).toBeVisible()
    await expect(price).toContainText('1,999')

    // City dropdown — for v1 only one option (SJ)
    const select = page.locator('[data-testid="city-select"]')
    await expect(select).toBeVisible()

    // CTA
    const buyButton = page.locator('[data-testid="buy-button"]')
    await expect(buyButton).toBeVisible()
    await expect(buyButton).toContainText('Configure research')

    // FAQ
    await expect(page.locator('[data-testid="research-faq"]')).toBeVisible()
  })

  test('invalid hash shows friendly message (no stack trace)', async ({ page }) => {
    await page.goto('/research/INVALID_HASH_NOT_IN_DB')
    await expect(page.locator("text=This link isn't valid")).toBeVisible()
  })

  test('clicking Configure research triggers /api/create-research-checkout', async ({ page }) => {
    const response = await page.goto(`/research/${TEST_HASH}`)
    if (!response || response.status() !== 200) {
      test.skip(true, 'Test data not seeded')
      return
    }

    const buyButton = page.locator('[data-testid="buy-button"]')
    if (!(await buyButton.isVisible().catch(() => false))) {
      test.skip(true, 'Buy button not visible — possibly already purchased')
      return
    }

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/create-research-checkout'),
      { timeout: 10_000 }
    )
    await buyButton.click()

    const apiResponse = await responsePromise
    // 200 = new session URL or already_purchased; 400 = invalid request
    expect([200, 400]).toContain(apiResponse.status())
  })
})

test.describe('Research status page', () => {
  test('non-purchaser gets 404 (no ownership leak)', async ({ page }) => {
    const response = await page.goto(`/research/${TEST_HASH}/${TEST_CITY}/status`)
    if (!response) {
      test.skip(true, 'Could not reach page')
      return
    }
    // For most test users, no research_purchases row exists → 404
    // For users that DO have a purchase, expect 200 + delivered/pending/cancelled
    if (response.status() === 200) {
      // Verify one of the three state sections is present
      const delivered = await page.locator('[data-testid="research-delivered"]').isVisible().catch(() => false)
      const pending = await page.locator('[data-testid="research-pending"]').isVisible().catch(() => false)
      const cancelled = await page.locator('[data-testid="research-cancelled"]').isVisible().catch(() => false)
      expect(delivered || pending || cancelled).toBe(true)
    } else {
      expect(response.status()).toBe(404)
    }
  })
})

test.describe('Public /pricing page', () => {
  test('renders without hash (publicly accessible)', async ({ page }) => {
    const response = await page.goto('/pricing')
    expect(response?.status()).toBe(200)

    // Hero
    await expect(page.locator('[data-testid="pricing-hero"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('Three ways')

    // All three tier rows present
    await expect(page.locator('[data-testid="pricing-tier-reveal"]')).toBeVisible()
    await expect(page.locator('[data-testid="pricing-tier-sj-report"]')).toBeVisible()
    await expect(page.locator('[data-testid="pricing-tier-research"]')).toBeVisible()

    // Prices in tabular order
    await expect(page.locator('[data-testid="pricing-price-reveal"]')).toContainText('$199')
    await expect(page.locator('[data-testid="pricing-price-sj-report"]')).toContainText('$499')
    await expect(page.locator('[data-testid="pricing-price-research"]')).toContainText('1,999')

    // CTAs route to /login with a tier-specific `next` param (v2 self-serve
    // signup contract — replaces the v1 mailto fallback).
    const revealCta = page.locator('[data-testid="pricing-cta-reveal"]')
    await expect(revealCta).toHaveAttribute('href', /^\/login\?next=/)
    await expect(revealCta).toHaveAttribute('href', new RegExp(encodeURIComponent('{hash}')))
  })

  test('does NOT show a Recommended badge anywhere (anti-slop guardrail)', async ({ page }) => {
    await page.goto('/pricing')
    // Per design Locked Decision #19: vertical ladder reading order IS the
    // recommendation. No badge, no highlight ring, no "Most popular" callout.
    const badges = await page.locator('text=/recommended/i').count()
    expect(badges).toBe(0)
  })
})

test.describe('Existing flows still work (regression — IRON RULE)', () => {
  test('list landing page (/list/[hash]/sj) still loads', async ({ page }) => {
    const response = await page.goto(`/list/${TEST_HASH}/sj`)
    if (!response || response.status() !== 200) {
      test.skip(true, 'Test data not seeded')
      return
    }
    // Hero or already-purchased redirect to success — either way we expect a header
    await expect(page.locator('header')).toBeVisible()
  })

  test('browse page (/browse/[hash]) still loads', async ({ page }) => {
    const response = await page.goto(`/browse/${TEST_HASH}`)
    if (!response || response.status() !== 200) {
      test.skip(true, 'Test data not seeded')
      return
    }
    await expect(page.locator('header')).toBeVisible()
  })
})
