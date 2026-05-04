import { test, expect } from '@playwright/test'

/**
 * E2E for /login + /auth/check-email.
 *
 * The actual magic-link click is exercised in unit + integration tests
 * (token verification, identity resolution). Here we verify the form UX:
 * validation, error rendering, success redirect, and the check-email page.
 *
 * Supabase Auth signInWithOtp POSTs to /auth/v1/otp on the project URL.
 * We intercept that with page.route to simulate success/failure without
 * touching Supabase.
 */

test.describe('/login form', () => {
  test('renders form and submits email → redirects to /auth/check-email', async ({ page }) => {
    await page.route(/\/auth\/v1\/otp/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      })
    })

    await page.goto('/login')
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

    await page.fill('[data-testid="login-email-input"]', 'hello@example.com')
    await page.click('[data-testid="login-submit"]')

    await page.waitForURL(/\/auth\/check-email\?email=hello%40example.com/)
    await expect(page.getByText('Check your email')).toBeVisible()
    await expect(page.getByText('hello@example.com')).toBeVisible()
  })

  test('rejects empty email with inline error', async ({ page }) => {
    await page.goto('/login')
    await page.click('[data-testid="login-submit"]')
    await expect(page.locator('[data-testid="login-error"]')).toContainText(
      'valid email'
    )
  })

  test('rejects malformed email with inline error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[data-testid="login-email-input"]', 'not-an-email')
    await page.click('[data-testid="login-submit"]')
    await expect(page.locator('[data-testid="login-error"]')).toContainText(
      'valid email'
    )
  })

  test('shows fallback error when Supabase Auth fails', async ({ page }) => {
    await page.route(/\/auth\/v1\/otp/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'rate limit' }),
      })
    })

    await page.goto('/login')
    await page.fill('[data-testid="login-email-input"]', 'fail@example.com')
    await page.click('[data-testid="login-submit"]')

    await expect(page.locator('[data-testid="login-error"]')).toContainText(
      'matthew@updatewave.com'
    )
  })

  test('callback error query renders the corresponding copy', async ({ page }) => {
    await page.goto('/login?error=link_expired')
    await expect(page.locator('[data-testid="login-callback-error"]')).toContainText(
      'expired'
    )
  })
})
