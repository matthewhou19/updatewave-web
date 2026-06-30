import { test, expect, type Page } from '@playwright/test'

/**
 * E2E for the /admin/leads review board (compact, collapsible, sortable).
 *
 * The board sits behind the ADMIN_PASSWORD gate and reads live data via the
 * service role. CI's e2e job runs against an ephemeral local Supabase WITHOUT
 * ADMIN_PASSWORD set, so this whole spec skips there (keeping CI green). It
 * runs wherever the password is provided — locally, or in CI once the secret
 * + seed data are wired in. The password the test types must match the dev
 * server's ADMIN_PASSWORD (both come from the same env).
 */

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

test.describe('/admin/leads board', () => {
  test.skip(!ADMIN_PASSWORD, 'ADMIN_PASSWORD not set — admin board E2E skipped')

  async function login(page: Page) {
    await page.goto('/admin/leads')
    // Gated → bounced to the password form.
    await expect(page.locator('[data-testid="admin-login-form"]')).toBeVisible()
    await page.fill('[data-testid="admin-password-input"]', ADMIN_PASSWORD!)
    await page.click('[data-testid="admin-login-submit"]')
    await page.waitForURL(/\/admin\/leads/)
    await expect(page.getByRole('heading', { name: 'Lead 审核' })).toBeVisible()
  }

  test('renders the board; 已上线 section starts collapsed', async ({ page }) => {
    await login(page)

    await expect(page.locator('[data-testid="counts"]')).toBeVisible()
    await expect(page.locator('[data-testid="section-toggle-candidate"]')).toBeVisible()

    const publishedToggle = page.locator('[data-testid="section-toggle-published"]')
    await expect(publishedToggle).toBeVisible()
    // Collapsed by default: shows the 展开 hint and renders no rows yet.
    await expect(publishedToggle).toContainText('展开')
    await expect(
      page.locator('[data-testid="section-published"] [data-testid="lead-row"]')
    ).toHaveCount(0)
  })

  test('expanding 已上线 reveals rows (or its empty state) + sort toolbar', async ({ page }) => {
    await login(page)
    const section = page.locator('[data-testid="section-published"]')

    await page.click('[data-testid="section-toggle-published"]')

    const rows = section.locator('[data-testid="lead-row"]')
    const empty = section.locator('[data-testid="empty-published"]')

    // After expanding, the section shows either lead rows or the empty-state line.
    await expect(async () => {
      const rowCount = await rows.count()
      const emptyVisible = await empty.isVisible().catch(() => false)
      expect(rowCount > 0 || emptyVisible).toBeTruthy()
    }).toPass()

    if ((await rows.count()) > 0) {
      await expect(section.locator('[data-testid="sort-address"]')).toBeVisible()
    }
  })

  test('clicking a lead row toggles its inline detail (with actions)', async ({ page }) => {
    await login(page)

    // 待审 is open by default; if it has no rows, expand 已上线 instead.
    const candidateRows = page.locator('[data-testid="section-candidate"] [data-testid="lead-row"]')
    let firstRow = candidateRows.first()
    if ((await candidateRows.count()) === 0) {
      await page.click('[data-testid="section-toggle-published"]')
      firstRow = page.locator('[data-testid="section-published"] [data-testid="lead-row"]').first()
    }
    test.skip((await firstRow.count()) === 0, 'no leads in the DB to expand')

    const detail = page.locator('[data-testid="lead-detail"]') // single-open accordion → unambiguous
    await expect(detail).toHaveCount(0)

    await firstRow.click()
    await expect(detail).toBeVisible()
    await expect(detail).toContainText(/批准上线|撤回批准/) // review actions live in the detail

    await firstRow.click()
    await expect(detail).toHaveCount(0)
  })

  test('sorting 已上线 by 地址 orders rows and flips direction on re-click', async ({ page }) => {
    await login(page)
    const section = page.locator('[data-testid="section-published"]')
    await page.click('[data-testid="section-toggle-published"]')

    const addresses = section.locator('[data-testid="lead-row"] .font-serif')
    test.skip((await addresses.count()) < 2, 'need ≥2 published leads to test sorting')

    const sortAddress = section.locator('[data-testid="sort-address"]')
    await sortAddress.click()
    await expect(sortAddress).toHaveAttribute('aria-pressed', 'true')

    const asc = await addresses.allInnerTexts()
    expect(asc).toEqual([...asc].sort((a, b) => a.localeCompare(b)))

    // Re-clicking the active key flips ascending → descending.
    await sortAddress.click()
    const desc = await addresses.allInnerTexts()
    expect(desc).toEqual([...asc].reverse())
  })
})
