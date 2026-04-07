import { test, expect } from '@playwright/test'

test.describe('Filter sidebar', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  })

  test('filters projects by city', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()

    // Get initial project count
    const showingText = page.locator('text=/Showing \\d+ project/').first()
    await expect(showingText).toBeVisible()
    const initialText = await showingText.textContent()
    const initialCount = parseInt(initialText?.match(/\d+/)?.[0] || '0')

    // Click a city filter checkbox (Los Altos should be available in test data)
    const losAltosCheckbox = page.locator('label:has-text("Los Altos") input[type="checkbox"]').first()
    if (await losAltosCheckbox.isVisible()) {
      await losAltosCheckbox.check()

      // Project count should change (filtered to Los Altos only)
      const filteredText = await showingText.textContent()
      const filteredCount = parseInt(filteredText?.match(/\d+/)?.[0] || '0')
      expect(filteredCount).toBeLessThanOrEqual(initialCount)
      expect(filteredCount).toBeGreaterThan(0)
    }
  })

  test('filter persistence via localStorage', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()

    // Select a city filter
    const losAltosCheckbox = page.locator('label:has-text("Los Altos") input[type="checkbox"]').first()
    if (await losAltosCheckbox.isVisible()) {
      await losAltosCheckbox.check()
      // Wait for localStorage to update
      await page.waitForTimeout(200)

      // Reload and verify filter is persisted
      await page.reload()
      await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()
      await expect(losAltosCheckbox).toBeChecked()
    }
  })

  test('clear all filters restores full list', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[class*="bg-white rounded-lg"]').first()).toBeVisible()

    // Apply a filter
    const losAltosCheckbox = page.locator('label:has-text("Los Altos") input[type="checkbox"]').first()
    if (await losAltosCheckbox.isVisible()) {
      await losAltosCheckbox.check()

      // Clear all
      const clearButton = page.locator('text=Clear all filters').first()
      await expect(clearButton).toBeVisible()
      await clearButton.click()

      // Checkbox should be unchecked
      await expect(losAltosCheckbox).not.toBeChecked()
    }
  })
})
