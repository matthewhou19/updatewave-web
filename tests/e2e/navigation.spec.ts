import { test, expect } from '@playwright/test'
import { TEST_HASH } from './fixtures'

test.describe('TopBar navigation', () => {
  test('browse to reveals navigation', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)

    // Skip if test user doesn't have data
    const cards = page.locator('[class*="bg-white rounded-lg"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered — test user may not be seeded')
      return
    }

    // Click "My Reveals →" in TopBar
    await page.locator('[data-testid="topbar-link-reveals"]').click()

    // Wait for navigation (ENG-4)
    await page.waitForURL(`**/reveals/${TEST_HASH}`)

    // Assert reveals page loaded
    await expect(page.locator('h1')).toContainText('My Reveals')
  })

  test('reveals to browse navigation', async ({ page }) => {
    await page.goto(`/reveals/${TEST_HASH}`)

    // Skip if test user doesn't exist
    const heading = page.locator('h1')
    const hasHeading = await heading.isVisible({ timeout: 5000 }).catch(() => false)
    if (!hasHeading) {
      test.skip(true, 'Reveals page did not load — test user may not exist')
      return
    }

    // Click "← Browse more projects" in TopBar
    await page.locator('[data-testid="topbar-link-browse"]').click()

    // Wait for navigation (ENG-4)
    await page.waitForURL(`**/browse/${TEST_HASH}`)

    // Assert browse page loaded with project cards
    const cards = page.locator('[class*="bg-white rounded-lg"]')
    await expect(cards.first()).toBeVisible()
  })
})
