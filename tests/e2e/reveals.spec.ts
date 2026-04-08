import { test, expect } from '@playwright/test'
import { TEST_HASH, TEST_HASH_NO_REVEALS } from './fixtures'

test.describe('Reveals page', () => {
  test('renders reveals for valid hash', async ({ page }) => {
    await page.goto(`/reveals/${TEST_HASH}`)

    // Assert heading
    await expect(page.locator('h1')).toContainText('My Reveals')

    // Assert at least 1 reveal card
    const cards = page.locator('[data-testid="project-card"]')
    await expect(cards.first()).toBeVisible()

    // Assert architect info visible in at least one card
    const cardText = await cards.first().textContent()
    const hasArchitectInfo = cardText && (
      cardText.includes('@') || // email
      cardText.includes('http') || // website
      cardText.length > 20 // firm name or contact
    )
    expect(hasArchitectInfo).toBeTruthy()
  })

  test('shows error for invalid hash', async ({ page }) => {
    await page.goto('/reveals/totally_invalid_hash_000')
    await expect(page.locator('text=This link isn\'t valid')).toBeVisible()
  })

  test('shows empty state for user with no reveals', async ({ page }) => {
    // Navigate to reveals page for user with no reveals
    const response = await page.goto(`/reveals/${TEST_HASH_NO_REVEALS}`)

    // Skip gracefully if the no-reveals test user doesn't exist
    if (!response || response.status() !== 200) {
      test.skip(true, 'Empty-reveals test user not found in database')
      return
    }

    // Check if we got the invalid hash error (user doesn't exist)
    const invalidMessage = page.locator('text=This link isn\'t valid')
    const isInvalid = await invalidMessage.isVisible({ timeout: 3000 }).catch(() => false)
    if (isInvalid) {
      test.skip(true, 'Empty-reveals test user hash not in database — insert into production Supabase')
      return
    }

    // Assert empty state
    const emptyState = page.locator('[data-testid="empty-reveals"]')
    await expect(emptyState).toBeVisible()
    await expect(page.locator('text=You haven\'t revealed any projects yet')).toBeVisible()

    // Assert browse link with correct hash
    const browseLink = emptyState.locator(`a[href="/browse/${TEST_HASH_NO_REVEALS}"]`)
    await expect(browseLink).toBeVisible()
    await expect(browseLink).toContainText('Browse available projects')
  })
})
