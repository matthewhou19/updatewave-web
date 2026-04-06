import { test, expect } from '@playwright/test'

// Post-deploy smoke tests — run against production URL.
// These verify the site is alive after a deploy.

test.describe('Production smoke tests', () => {
  test('homepage returns 200 and contains heading', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.locator('text=Pre-permit projects in your area')).toBeVisible()
  })

  test('API is alive (create-checkout returns 400 for invalid body)', async ({ request }) => {
    const response = await request.post('/api/create-checkout', {
      data: {},
      headers: { 'content-type': 'application/json' },
    })
    // 400 means the API processed the request and rejected it — it's alive
    expect(response.status()).toBe(400)
  })

  test('security headers are present', async ({ page }) => {
    const response = await page.goto('/')
    const headers = response?.headers() ?? {}
    expect(headers['x-frame-options']).toBe('SAMEORIGIN')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('no-referrer')
  })
})
