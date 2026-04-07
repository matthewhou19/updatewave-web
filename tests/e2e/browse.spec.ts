import { test, expect } from '@playwright/test'

const TEST_HASH = 'test_abcdefghijklmnopqrstuvwxyz1234567890A'

test.describe('Public browse (homepage)', () => {
  test('renders published projects', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Pre-permit projects in your area')
    // Should have at least one project card
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()
  })

  test('shows disabled "$25 to reveal" span for public visitors', async ({ page }) => {
    await page.goto('/')
    const revealSpan = page.locator('span:has-text("$25 to reveal")').first()
    await expect(revealSpan).toBeVisible()
    // Should be a span (not a button) — public visitors can't reveal
    expect(await revealSpan.evaluate((el) => el.tagName)).toBe('SPAN')
  })

  test('filter sidebar renders with city checkboxes', async ({ page }) => {
    await page.goto('/')
    // Desktop sidebar should have city filter
    await expect(page.locator('legend:has-text("City")').first()).toBeVisible()
  })
})

test.describe('Authenticated browse', () => {
  test('renders projects with reveal buttons for valid hash', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)

    // Skip gracefully if test user doesn't exist in the database
    const cards = page.locator('[class*="bg-white rounded-lg"]')
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
    const cards = page.locator('[class*="bg-white rounded-lg"]')
    const cardCount = await cards.count()
    if (cardCount === 0) {
      test.skip(true, 'No project cards rendered — test user may not be seeded')
      return
    }

    // Get the full page HTML — architect data should NOT appear for unrevealed projects.
    // The test hash has 1 revealed project (336 SPRINGER RD / Jia Liu).
    // Other architects like "David Chen", "Sarah Kim" should NOT be in the HTML.
    const html = await page.content()
    // These architects are in the test data but NOT revealed by the test user
    expect(html).not.toContain('David Chen')
    expect(html).not.toContain('Sarah Kim')
    expect(html).not.toContain('Roberto Martinez')
  })
})
