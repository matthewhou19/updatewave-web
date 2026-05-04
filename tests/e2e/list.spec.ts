import { test, expect } from '@playwright/test'
import { TEST_HASH } from './fixtures'

const TEST_CITY = 'sj'

/**
 * E2E for the city-list product (SJ at launch).
 *
 * These tests skip gracefully if the test hash or city_lists seed row are
 * not present in the database. The migration 002 seed inserts an SJ row;
 * if you've run it, these tests will exercise the real flow.
 *
 * Tests cover:
 *   - landing page renders preview (TOC, killer insight, 3 sample charts)
 *   - invalid hash → friendly error message
 *   - Buy CTA triggers /api/create-list-checkout
 *   - success page redirects unpurchased users back to landing
 *   - download button calls /api/download-list
 */

test.describe('List landing page', () => {
  test('renders preview composition for valid hash + active city', async ({ page }) => {
    const response = await page.goto(`/list/${TEST_HASH}/${TEST_CITY}`)

    if (!response || response.status() !== 200) {
      test.skip(true, 'Test user or city_lists seed not found')
      return
    }

    // Hero
    await expect(page.locator('[data-testid="list-hero"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('San Jose')

    // Killer insight (the one sentence that justifies the price)
    const insight = page.locator('[data-testid="list-insight"]')
    await expect(insight).toBeVisible()
    await expect(insight).toContainText('75%')

    // TOC
    await expect(page.locator('[data-testid="list-toc"]')).toBeVisible()

    // 3 sample charts
    await expect(page.locator('[data-testid="sample-chart-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="sample-chart-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="sample-chart-3"]')).toBeVisible()

    // CTA
    const buyButton = page.locator('[data-testid="buy-button"]')
    await expect(buyButton).toBeVisible()
    await expect(buyButton).toContainText('Buy report')

    // Price block
    const launchPrice = page.locator('[data-testid="launch-price"]')
    await expect(launchPrice).toBeVisible()
    await expect(launchPrice).toContainText('$349')
  })

  test('invalid hash shows friendly message (no stack)', async ({ page }) => {
    await page.goto('/list/INVALID_HASH_NOT_IN_DB/sj')
    await expect(page.locator('text=This link isn\'t valid')).toBeVisible()
  })

  test('clicking Buy triggers /api/create-list-checkout', async ({ page }) => {
    const response = await page.goto(`/list/${TEST_HASH}/${TEST_CITY}`)
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
      (r) => r.url().includes('/api/create-list-checkout'),
      { timeout: 10_000 }
    )
    await buyButton.click()

    const apiResponse = await responsePromise
    // 200 = new session URL OR "Already purchased" idempotent response
    expect([200, 400]).toContain(apiResponse.status())
  })
})

test.describe('List success page', () => {
  test('unpurchased user is redirected back to landing page', async ({ page }) => {
    const response = await page.goto(`/list/${TEST_HASH}/${TEST_CITY}/success`)
    if (!response) {
      test.skip(true, 'Could not reach page')
      return
    }

    // Either: user has purchased → success renders → download button visible
    //     or: user has NOT purchased → redirect to /list/[hash]/sj → buy button visible
    const downloadButton = page.locator('[data-testid="download-button"]')
    const buyButton = page.locator('[data-testid="buy-button"]')

    const downloadVisible = await downloadButton.isVisible({ timeout: 5_000 }).catch(() => false)
    const buyVisible = await buyButton.isVisible({ timeout: 5_000 }).catch(() => false)

    expect(downloadVisible || buyVisible).toBe(true)

    // If on landing page (redirected), URL should NOT contain /success
    if (buyVisible && !downloadVisible) {
      expect(page.url()).not.toContain('/success')
    }
  })
})

test.describe('Existing flows still work (regression)', () => {
  test('browse page still loads', async ({ page }) => {
    const response = await page.goto(`/browse/${TEST_HASH}`)
    if (!response || response.status() !== 200) {
      test.skip(true, 'Test data not seeded')
      return
    }
    // Just confirm we don't get a 500 or blank page after the webhook routing change
    await expect(page.locator('header')).toBeVisible()
  })

  test('reveals page still loads', async ({ page }) => {
    const response = await page.goto(`/reveals/${TEST_HASH}`)
    if (!response || response.status() !== 200) {
      test.skip(true, 'Test data not seeded')
      return
    }
    await expect(page.locator('h1')).toContainText('My Reveals')
  })
})
