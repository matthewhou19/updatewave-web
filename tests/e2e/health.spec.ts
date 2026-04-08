import { test, expect } from '@playwright/test'
import { TEST_HASH } from './fixtures'

test.describe('Test data health check', () => {
  test('test user exists and has project cards', async ({ page }) => {
    await page.goto(`/browse/${TEST_HASH}`)
    const cards = page.locator('[data-testid="project-card"], [class*="bg-white rounded-lg"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  })

  test('test user has at least one reveal', async ({ page }) => {
    await page.goto(`/reveals/${TEST_HASH}`)
    await expect(page.locator('h1')).toContainText('My Reveals')
    const cards = page.locator('[data-testid="project-card"]')
    await expect(cards.first()).toBeVisible({ timeout: 10_000 })
  })
})
