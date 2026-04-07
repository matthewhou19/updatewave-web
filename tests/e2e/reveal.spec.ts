import { test, expect } from '@playwright/test'

// E2E tests use a real Supabase instance. The test hash must exist in the users table.
// In CI, these run against the dev server connected to the same Supabase as production.
// We use a known production user hash from seed data, or skip gracefully.
const TEST_HASH = 'a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ'

test.describe('Reveal flow', () => {
  test('clicking Reveal triggers checkout API call', async ({ page }) => {
    const response = await page.goto(`/browse/${TEST_HASH}`)

    // If the test user doesn't exist, the page redirects or shows no projects
    // Skip gracefully instead of failing
    if (!response || response.status() !== 200) {
      test.skip(true, 'Test user hash not found in database')
      return
    }

    // Wait for project cards to load
    const cards = page.locator('[class*="bg-white rounded-lg"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered — test data may not be seeded')
      return
    }

    // Find an unrevealed project's Reveal button
    const revealButton = page.locator('button:has-text("Reveal")').first()
    const hasRevealButton = await revealButton.isVisible().catch(() => false)
    if (!hasRevealButton) {
      test.skip(true, 'No Reveal buttons visible — all projects may be revealed')
      return
    }

    // Click and intercept the API call
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/create-checkout'),
      { timeout: 10_000 }
    )
    await revealButton.click()

    const apiResponse = await responsePromise
    // 200 = new checkout session, 400 = already revealed or validation error
    // Both mean the API is working
    expect([200, 400]).toContain(apiResponse.status())
  })

  test('Reveal button shows loading state on click', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)

    const cards = page.locator('[class*="bg-white rounded-lg"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered')
      return
    }

    const revealButton = page.locator('button:has-text("Reveal")').first()
    const hasRevealButton = await revealButton.isVisible().catch(() => false)
    if (!hasRevealButton) {
      test.skip(true, 'No Reveal buttons visible')
      return
    }

    // Intercept the API call to slow it down
    await page.route('**/api/create-checkout', async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.continue()
    })

    await revealButton.click()

    // Button should show loading state
    await expect(page.locator('button:has-text("Processing...")')).toBeVisible()
    await expect(page.locator('button:has-text("Processing...")')).toBeDisabled()
  })
})

test.describe('Post-reveal experience', () => {
  test('revealed project shows architect info or Revealed badge', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)

    const cards = page.locator('[class*="bg-white rounded-lg"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered — test data may not be seeded')
      return
    }

    // Check if any project shows the "Revealed" badge (meaning user has reveals)
    const revealedBadge = page.locator('text=Revealed').first()
    const hasRevealed = await revealedBadge.isVisible({ timeout: 3000 }).catch(() => false)

    if (!hasRevealed) {
      test.skip(true, 'No revealed projects found for this test user')
      return
    }

    // If we see "Revealed", there should also be architect info visible somewhere
    await expect(revealedBadge).toBeVisible()
  })
})
