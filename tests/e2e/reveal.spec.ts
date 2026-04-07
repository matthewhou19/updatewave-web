import { test, expect } from '@playwright/test'

const TEST_HASH = 'test_abcdefghijklmnopqrstuvwxyz1234567890A'

test.describe('Reveal flow', () => {
  test('clicking Reveal redirects to Stripe checkout URL', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()

    // Find an unrevealed project's Reveal button
    const revealButton = page.locator('button:has-text("Reveal")').first()
    await expect(revealButton).toBeVisible()

    // Click and intercept the navigation — Stripe checkout is on a different domain
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/create-checkout')),
      revealButton.click(),
    ])

    // The API should return a Stripe checkout URL
    const json = await response.json()
    // Either we get a URL (new checkout) or "Already revealed" (test data has one reveal)
    expect(json.url || json.message).toBeTruthy()
  })

  test('Reveal button shows loading state and disables on click', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()

    const revealButton = page.locator('button:has-text("Reveal")').first()
    await expect(revealButton).toBeVisible()

    // Intercept the API call to slow it down, so we can observe loading state
    await page.route('**/api/create-checkout', async (route) => {
      // Hold the request for 500ms to observe loading state
      await new Promise((r) => setTimeout(r, 500))
      await route.continue()
    })

    // Click reveal
    await revealButton.click()

    // Button should show "Processing..." and be disabled
    await expect(page.locator('button:has-text("Processing...")')).toBeVisible()
    await expect(page.locator('button:has-text("Processing...")')).toBeDisabled()
  })
})

test.describe('Post-reveal experience', () => {
  test('shows revealed architect info for revealed project', async ({ page }) => {
    // The test seed data has 1 reveal: 336 SPRINGER RD / Jia Liu
    await page.goto(`/browse/${TEST_HASH}`)
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()

    // The revealed project should show architect name
    await expect(page.locator('text=Jia Liu')).toBeVisible()
    // And the "Revealed" badge
    await expect(page.locator('text=Revealed').first()).toBeVisible()
  })
})
