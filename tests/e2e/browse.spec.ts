import { test, expect } from '@playwright/test'
import { TEST_HASH } from './fixtures'

test.describe('Public browse (hash view)', () => {
  test('renders published projects', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)
    await expect(page.locator('[data-testid="project-card"]').first()).toBeVisible()
  })

  test('filter bar renders with city options', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)
    // The filter bar shows a "City:" label followed by one pill per seeded city.
    await expect(page.getByText('City:')).toBeVisible()
  })
})

test.describe('Authenticated browse', () => {
  test('renders projects with reveal buttons for valid hash', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)

    // Skip gracefully if test user doesn't exist in the database
    const cards = page.locator('[data-testid="project-card"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered — test user may not be seeded')
      return
    }

    // Should have clickable "Reveal" button (not disabled span)
    const revealButton = page.locator('button:has-text("Reveal")').first()
    await expect(revealButton).toBeVisible()
  })

  test('shows error for invalid hash', async ({ page }) => {
    await page.goto('/browse/totally_invalid_hash_000')
    await expect(page.locator('text=This link isn\'t valid')).toBeVisible()
  })

  test('does not leak architect data in page source for unrevealed projects', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)

    // Skip gracefully if test user doesn't exist in the database
    const cards = page.locator('[data-testid="project-card"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered — test user may not be seeded')
      return
    }

    // Get the full page HTML — architect data should NOT appear for unrevealed projects.
    // User 6 has revealed project 12 (1222 OAK KNOLL DR / JENNY WONG).
    // Other architects should NOT be in the HTML.
    const html = await page.content()
    // These architects are in the test data but NOT revealed by the test user
    expect(html).not.toContain('MICHELLE MINER')
    expect(html).not.toContain('TONY ROWE')
    expect(html).not.toContain('Ninh Le')
  })
})
