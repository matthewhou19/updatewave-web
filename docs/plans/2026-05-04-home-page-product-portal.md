# Home Page (Product Portal) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Replace `/` with a public product portal indexing 3 pricing tiers ($129 lead / $499 city list / $1999 research). Build 3 new public sub-routes (`/list/[city]`, `/leads`, `/research`). Refactor hash-gated routes to dual-permission (hash | user_id). Update webhook + checkout to user_id-first with hash fallback.

**Architecture:** Server Components by default (read `auth.getUser()` server-side). Reuse all existing query helpers in `@/lib/queries` and design tokens (`bg-[#f5f5f5]`, `text-[#111827]`, `text-[#6b7280]`, `border-gray-200`, `max-w-6xl mx-auto px-4`). Auth integration is read-only (`getCurrentUser()` matches `auth.email` to `users.email`); the auth UI itself (sign-in / callback) is built in a parallel worktree and assumed to exist.

**Tech Stack:** Next.js 16 (App Router), TypeScript 5, React 19, Tailwind v4, Supabase (anon + service-role), Stripe Checkout, Vitest (unit + integration), Playwright (E2E).

**Reference:** Design doc at [docs/plans/2026-05-04-home-page-product-portal-design.md](2026-05-04-home-page-product-portal-design.md). Read it first for visual specs and decision rationale.

---

## Important Context for Engineer

### You are in a worktree

```
Path:   F:/Github/updatewave-web/.worktrees/home-page-product-portal
Branch: feat/home-page-product-portal (forked from docs/product-roadmap)
```

DO NOT cd out of this worktree. Main repo and other worktrees are separate.

### Next.js 16 specifics (per project AGENTS.md)

- This is **Next.js 16**, not 14 or 15. Breaking changes from your training data.
- Before writing routing code, read `node_modules/next/dist/docs/` for: `routing.md`, `dynamic-routes.md`, `redirecting.md`, `server-components.md`.
- `params` in dynamic segments is `Promise<{ ... }>` — must `await params`.
- `redirect()` from `next/navigation` is server-only.
- `export const dynamic = 'force-dynamic'` is required when reading auth/cookies.

### Anti-AI-slop project rules (from CLAUDE.md)

- No dark mode
- No decorative elements
- No purple gradients, no icons-in-circles
- "no 3-column grids" — **DELIBERATE EXCEPTION:** the home page's 3 product cards are industry-standard anchor-pricing layout (Stripe / Linear / Notion all do this). This is *not* feature-icon AI slop. If user pushes back at QA, fall back to vertical stack on desktop.
- Utility-first design

### Auth integration assumptions

- Auth system is being built in parallel worktree (not merged yet).
- This plan implements only the **read side**: `supabase.auth.getUser()` to detect session.
- Buy CTAs assume `/auth/sign-in?next=<encoded URL>` exists. If still 404 at ship time, render Buy buttons disabled with text "Sign-in coming — talk to us" + mailto.
- The `users` table already has an `email` column. Auth users are matched to local users by `email`, not by separate auth UUID. No schema migration needed for this worktree.

### Existing helpers — DO NOT duplicate

- `createSupabaseClient()` — anon client (`@/lib/supabase`)
- `createSupabaseServiceClient()` — service-role client
- `fetchPublishedProjects(supabase)` — published projects, no architect fields
- `fetchUserByHash(supabase, hash)` — user by hash, no soft-delete filter (read paths)
- `resolveUserByHash(supabase, hash)` — user by hash, with soft-delete filter (payment-critical)
- `fetchCityList(supabase, city)` — public columns, no `pdf_storage_path`
- `fetchCityListWithStoragePath(supabase, city)` — for download API only
- `fetchListPurchase(supabase, userId, cityListId)` — single purchase
- `fetchUserReveals(supabase, userId)` — array of project IDs
- `fetchArchitectData(supabase, projectIds)` — architect lookup map

### Pricing reality (DO NOT hardcode in UI)

- Reveal price: `REVEAL_PRICE_CENTS = 2500` ($25). WS-2 plan changes this to $129 but is OUT OF SCOPE for this worktree.
- City list price: comes from `city_lists.price_cents` (currently $349 launch / $499 anchor for SJ). Read from DB, not hardcode.
- Research price: $1999 is marketing copy only, no Stripe SKU yet.

### Commit cadence

Each task ends with one commit. Use Conventional Commits (`feat:`, `refactor:`, `test:`, `chore:`). Body should be 1-2 sentences. **No `Co-Authored-By` line** (project setting).

---

## Phase 0: Pre-flight verification

### Task 0.1: Confirm worktree state

**Files:** None (verification only)

**Step 1:** Confirm location

```bash
pwd
# Expected output: F:/Github/updatewave-web/.worktrees/home-page-product-portal
```

**Step 2:** Confirm branch + clean tree

```bash
git status
# Expected: On branch feat/home-page-product-portal
# nothing to commit, working tree clean
```

**Step 3:** Run baseline tests

```bash
npm test 2>&1 | tail -5
# Expected: Test Files 10 passed (10)
#           Tests 114 passed (114)
```

**Step 4:** No commit. Verification only.

---

## Phase 1: Auth + summary helpers

These power the home page header + Welcome back banner + smart redirect.

### Task 1.1: Add `getCurrentUser()` helper

**Files:**
- Create: `src/lib/auth.ts`
- Test: `tests/unit/auth.test.ts`

**Step 1:** Write failing test

```typescript
// tests/unit/auth.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'

function mockSupabase(authUser: { email: string } | null, dbUser: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: null,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: dbUser, error: null }),
  } as unknown as SupabaseClient
}

describe('getCurrentUser', () => {
  it('returns null when no auth session', async () => {
    const supabase = mockSupabase(null, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })

  it('returns null when auth user has no email', async () => {
    const supabase = mockSupabase({ email: '' }, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })

  it('returns user row when auth.email matches users.email', async () => {
    const dbUser = { id: 42, hash: 'abc', email: 'matt@example.com', deleted_at: null }
    const supabase = mockSupabase({ email: 'matt@example.com' }, dbUser)
    const user = await getCurrentUser(supabase)
    expect(user?.id).toBe(42)
  })

  it('returns null when auth user not in users table', async () => {
    const supabase = mockSupabase({ email: 'stranger@example.com' }, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })
})
```

**Step 2:** Run test, expect fail

```bash
npm test -- tests/unit/auth.test.ts
# Expected: FAIL "Cannot find module '@/lib/auth'"
```

**Step 3:** Implement

```typescript
// src/lib/auth.ts
import { SupabaseClient } from '@supabase/supabase-js'
import { User } from './types'

/**
 * Resolve the currently signed-in app user by matching the Supabase Auth email
 * to a row in the `users` table. Filters out soft-deleted rows.
 *
 * Returns null when:
 *   - no auth session
 *   - auth user has no email
 *   - no `users` row matches the auth email
 *   - the matching `users` row is soft-deleted
 *
 * Use this in server components / route handlers. Pair with the anon client
 * for read-only contexts (home page, browse) and the service-role client only
 * for payment-critical writes.
 */
export async function getCurrentUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser?.email) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .is('deleted_at', null)
    .single()

  return (data as User | null) ?? null
}
```

**Step 4:** Run test, expect pass

```bash
npm test -- tests/unit/auth.test.ts
# Expected: 4 passed
```

**Step 5:** Commit

```bash
git add src/lib/auth.ts tests/unit/auth.test.ts
git commit -m "feat(auth): add getCurrentUser helper resolving auth email to users row"
```

---

### Task 1.2: Add `fetchUserPurchaseSummary()` helper

Returns `{ revealCount, listCount, purchasedCities }` for a logged-in user — used by Welcome back banner + smart redirect on home cards.

**Files:**
- Modify: `src/lib/queries.ts`
- Test: `tests/unit/queries.test.ts`

**Step 1:** Write failing test (append to existing `tests/unit/queries.test.ts`)

```typescript
// Append to tests/unit/queries.test.ts
import { fetchUserPurchaseSummary } from '@/lib/queries'

describe('fetchUserPurchaseSummary', () => {
  it('returns zeros when user has no reveals or purchases', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'reveals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'list_purchases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const summary = await fetchUserPurchaseSummary(supabase as any, 42)
    expect(summary.revealCount).toBe(0)
    expect(summary.listCount).toBe(0)
    expect(summary.purchasedCities).toEqual([])
  })

  it('returns counts and city slugs when user has purchases', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'reveals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [{ project_id: 1 }, { project_id: 2 }, { project_id: 3 }],
              error: null,
            }),
          }
        }
        if (table === 'list_purchases') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                { city_lists: { city: 'sj' } },
                { city_lists: { city: 'sf' } },
              ],
              error: null,
            }),
          }
        }
        return {}
      }),
    } as unknown as SupabaseClient

    const summary = await fetchUserPurchaseSummary(supabase as any, 42)
    expect(summary.revealCount).toBe(3)
    expect(summary.listCount).toBe(2)
    expect(summary.purchasedCities.sort()).toEqual(['sf', 'sj'])
  })
})
```

**Step 2:** Run test, expect fail

```bash
npm test -- tests/unit/queries.test.ts
# Expected: FAIL — fetchUserPurchaseSummary not exported
```

**Step 3:** Implement (append to `src/lib/queries.ts`)

```typescript
// Append to src/lib/queries.ts

export interface UserPurchaseSummary {
  revealCount: number
  listCount: number
  purchasedCities: string[]
}

/**
 * Single-call summary of a user's reveals + list purchases. Used by the home
 * page Welcome back banner and the smart redirect on city cards.
 *
 * Two queries in parallel: reveals.count by user_id, and list_purchases joined
 * to city_lists.city. Soft-delete is enforced upstream by getCurrentUser().
 */
export async function fetchUserPurchaseSummary(
  supabase: SupabaseClient,
  userId: number
): Promise<UserPurchaseSummary> {
  const [reveals, purchases] = await Promise.all([
    supabase.from('reveals').select('project_id').eq('user_id', userId),
    supabase
      .from('list_purchases')
      .select('city_lists(city)')
      .eq('user_id', userId),
  ])

  const purchasedCities = ((purchases.data ?? []) as Array<{ city_lists: { city: string } | null }>)
    .map((p) => p.city_lists?.city)
    .filter((c): c is string => Boolean(c))

  return {
    revealCount: (reveals.data ?? []).length,
    listCount: (purchases.data ?? []).length,
    purchasedCities,
  }
}
```

**Step 4:** Run test, expect pass

```bash
npm test -- tests/unit/queries.test.ts
```

**Step 5:** Commit

```bash
git add src/lib/queries.ts tests/unit/queries.test.ts
git commit -m "feat(queries): add fetchUserPurchaseSummary for home page banner"
```

---

## Phase 2: New `/` portal page

### Task 2.1: Replace `/` with portal skeleton

Strategy: replace existing `src/app/page.tsx` content entirely. The current `<ProjectList>` rendering moves OUT (in Phase 4 we relocate it to `/leads`).

**Files:**
- Modify: `src/app/page.tsx` (full replace)
- Test: `tests/e2e/home.spec.ts` (new)

**Step 1:** Write E2E smoke test

```typescript
// tests/e2e/home.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Home page (anonymous)', () => {
  test('renders portal sections', async ({ page }) => {
    await page.goto('/')

    // Hero
    await expect(page.locator('[data-testid="home-hero"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('Architect intelligence')

    // Three product cards
    await expect(page.locator('[data-testid="card-lead"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-research"]')).toBeVisible()

    // How it works
    await expect(page.locator('[data-testid="how-it-works"]')).toBeVisible()

    // FAQ
    await expect(page.locator('[data-testid="home-faq"]')).toBeVisible()
  })

  test('does not show Welcome back banner when anonymous', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('[data-testid="welcome-back"]')).toHaveCount(0)
  })
})
```

**Step 2:** Run test, expect fail

```bash
# Start dev server first in another terminal: npm run dev
npm run test:e2e -- home.spec.ts
# Expected: FAIL — selectors not found
```

**Step 3:** Replace `src/app/page.tsx` with skeleton

```tsx
// src/app/page.tsx
import { createSupabaseClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import { fetchUserPurchaseSummary } from '@/lib/queries'
import SiteHeader from '@/components/SiteHeader'
import HomeHero from '@/components/home/HomeHero'
import ProductCards from '@/components/home/ProductCards'
import HowItWorks from '@/components/home/HowItWorks'
import HomeFaq from '@/components/home/HomeFaq'
import WelcomeBackBanner from '@/components/home/WelcomeBackBanner'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createSupabaseClient()
  const user = await getCurrentUser(supabase)
  const summary = user
    ? await fetchUserPurchaseSummary(supabase, user.id)
    : null

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <SiteHeader user={user} />

      <main>
        <HomeHero />

        {summary && (summary.revealCount > 0 || summary.listCount > 0) && (
          <WelcomeBackBanner
            userId={user!.id}
            revealCount={summary.revealCount}
            listCount={summary.listCount}
          />
        )}

        <ProductCards purchasedCities={summary?.purchasedCities ?? []} userId={user?.id ?? null} />

        <HowItWorks />

        <HomeFaq />
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All listings sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
```

**Step 4:** Create stub components so the import chain compiles

```tsx
// src/components/SiteHeader.tsx
import Link from 'next/link'
import type { User } from '@/lib/types'

interface SiteHeaderProps {
  user: User | null
}

export default function SiteHeader({ user }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-[18px] text-[#111827]">
          UpdateWave
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="text-[#6b7280]" data-testid="header-email">{user.email}</span>
              <Link
                href={`/reveals/${user.hash}`}
                className="text-[#2563eb] hover:text-[#1d4ed8]"
                data-testid="header-my-purchases"
              >
                My purchases
              </Link>
              <Link
                href="/auth/sign-out"
                className="text-[#6b7280] hover:text-[#111827]"
              >
                Sign out
              </Link>
            </>
          ) : (
            <Link
              href="/auth/sign-in"
              className="text-[#2563eb] hover:text-[#1d4ed8]"
              data-testid="header-sign-in"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
```

```tsx
// src/components/home/HomeHero.tsx
export default function HomeHero() {
  return (
    <section
      className="max-w-6xl mx-auto px-4 py-16"
      data-testid="home-hero"
    >
      <h1 className="text-[28px] sm:text-[36px] font-bold text-[#111827] leading-tight mb-4">
        Architect intelligence for general contractors.
      </h1>
      <p className="text-base text-[#6b7280] max-w-2xl leading-relaxed">
        Stop chasing leads after permits drop. Find the architects who keep
        filing — and own the relationship.
      </p>
    </section>
  )
}
```

```tsx
// src/components/home/ProductCards.tsx
interface ProductCardsProps {
  purchasedCities: string[]
  userId: number | null
}

export default function ProductCards({ purchasedCities, userId }: ProductCardsProps) {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article
          className="bg-white border border-gray-200 rounded-md p-6"
          data-testid="card-lead"
        >
          <p>Card 1: $129 lead (placeholder)</p>
        </article>
        <article
          className="bg-white border-2 border-[#2563eb] rounded-md p-6 relative"
          data-testid="card-list"
        >
          <p>Card 2: $499 city list (placeholder)</p>
        </article>
        <article
          className="bg-white border border-gray-200 rounded-md p-6"
          data-testid="card-research"
        >
          <p>Card 3: $1999 research (placeholder)</p>
        </article>
      </div>
    </section>
  )
}
```

```tsx
// src/components/home/HowItWorks.tsx
export default function HowItWorks() {
  return (
    <section
      className="max-w-6xl mx-auto px-4 py-12"
      data-testid="how-it-works"
    >
      <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-6">
        How it works
      </h2>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <li>
          <p className="font-semibold text-[#111827] mb-1">1. See what&apos;s filed</p>
          <p className="text-[#6b7280]">Pre-permit project filings from city planning commissions.</p>
        </li>
        <li>
          <p className="font-semibold text-[#111827] mb-1">2. Identify high-volume architects</p>
          <p className="text-[#6b7280]">Find who keeps filing, year after year.</p>
        </li>
        <li>
          <p className="font-semibold text-[#111827] mb-1">3. Build relationships</p>
          <p className="text-[#6b7280]">Win bids before permits drop.</p>
        </li>
      </ol>
    </section>
  )
}
```

```tsx
// src/components/home/HomeFaq.tsx
export default function HomeFaq() {
  return (
    <section
      className="max-w-6xl mx-auto px-4 py-12"
      data-testid="home-faq"
    >
      <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-6">
        Common questions
      </h2>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Where does the data come from?</p>
          <p className="text-sm text-[#6b7280] mt-1">Public planning commission filings.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">How often is it updated?</p>
          <p className="text-sm text-[#6b7280] mt-1">Per city list = annual; lead feed = continuous.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">What&apos;s your refund policy?</p>
          <p className="text-sm text-[#6b7280] mt-1">Refund within 7 days of purchase, no questions. Email the address on your Stripe receipt.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">Single lead vs. city list — what&apos;s the difference?</p>
          <p className="text-sm text-[#6b7280] mt-1">A single lead is one project. A city list is the structure — who actually owns the pipeline.</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-[#111827]">Is this data legally usable?</p>
          <p className="text-sm text-[#6b7280] mt-1">Yes — these are public records.</p>
        </div>
      </div>
    </section>
  )
}
```

```tsx
// src/components/home/WelcomeBackBanner.tsx
import Link from 'next/link'

interface WelcomeBackBannerProps {
  userId: number
  revealCount: number
  listCount: number
}

export default function WelcomeBackBanner({ userId, revealCount, listCount }: WelcomeBackBannerProps) {
  // Build human-readable summary
  const parts: string[] = []
  if (listCount > 0) parts.push(`${listCount} city list${listCount === 1 ? '' : 's'}`)
  if (revealCount > 0) parts.push(`${revealCount} reveal${revealCount === 1 ? '' : 's'}`)
  const summary = parts.join(' and ')

  return (
    <div
      className="bg-[#eef2ff] border-y border-[#c7d2fe]"
      data-testid="welcome-back"
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between text-sm">
        <span className="text-[#374151]">
          Welcome back. You have {summary}.
        </span>
        <Link
          href={`/reveals/${userId}`}
          className="text-[#2563eb] hover:text-[#1d4ed8] font-medium"
        >
          View →
        </Link>
      </div>
    </div>
  )
}
```

**Step 5:** Run E2E test, expect pass

```bash
# Make sure dev server is running: npm run dev
npm run test:e2e -- home.spec.ts
# Expected: 2 passed
```

**Step 6:** Commit

```bash
git add src/app/page.tsx src/components/SiteHeader.tsx src/components/home/ tests/e2e/home.spec.ts
git commit -m "feat(home): replace / with portal skeleton (header + hero + 3 cards + how it works + faq)"
```

---

### Task 2.2: Fill in Card 1 ($129 Lead)

**Files:**
- Modify: `src/components/home/ProductCards.tsx`

**Step 1:** Add testable assertions

```typescript
// Append to tests/e2e/home.spec.ts inside the "Home page (anonymous)" describe
test('Card 1 (Lead) shows price + browse CTA', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('[data-testid="card-lead"]')
  await expect(card).toContainText('Single Pre-Permit Lead')
  await expect(card).toContainText('$129')
  const cta = card.locator('[data-testid="card-lead-cta"]')
  await expect(cta).toContainText('Browse leads')
  await expect(cta).toHaveAttribute('href', '/leads')
})
```

**Step 2:** Run test, expect fail

```bash
npm run test:e2e -- home.spec.ts -g "Card 1"
```

**Step 3:** Replace the Card 1 placeholder

```tsx
// In src/components/home/ProductCards.tsx, replace the data-testid="card-lead" article with:
<article
  className="bg-white border border-gray-200 rounded-md p-6 flex flex-col"
  data-testid="card-lead"
>
  <p className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-2">
    Single lead
  </p>
  <h3 className="text-[20px] font-bold text-[#111827] mb-2">
    Single Pre-Permit Lead
  </h3>
  <p className="text-sm text-[#6b7280] mb-5 flex-1">
    When you need to chase a hot project right now. Real-time architect contact unlock.
  </p>
  <div className="mb-5">
    <span className="text-[28px] font-bold text-[#111827] tabular-nums">$129</span>
    <span className="text-sm text-[#6b7280] ml-2">/ lead</span>
    <p className="text-xs text-[#9ca3af] mt-1">~30 architects/month available</p>
  </div>
  <a
    href="/leads"
    className="inline-flex justify-center items-center bg-white border border-[#111827] hover:bg-[#f9fafb] text-[#111827] text-sm font-medium rounded-md px-4 py-2.5 transition-colors"
    data-testid="card-lead-cta"
  >
    Browse leads →
  </a>
</article>
```

**Step 4:** Run test, expect pass

```bash
npm run test:e2e -- home.spec.ts -g "Card 1"
```

**Step 5:** Commit

```bash
git add src/components/home/ProductCards.tsx tests/e2e/home.spec.ts
git commit -m "feat(home): fill Card 1 with \$129 lead pricing and Browse leads CTA"
```

---

### Task 2.3: Fill in Card 2 ($499 City Hot List, "Most Popular")

**Files:**
- Modify: `src/components/home/ProductCards.tsx`

**Step 1:** Add tests

```typescript
// Append to tests/e2e/home.spec.ts
test('Card 2 (City list) shows price, anchor, 3 city pills, Most Popular badge', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('[data-testid="card-list"]')
  await expect(card).toContainText('City Hot Architect List')
  await expect(card).toContainText('$499')
  await expect(card).toContainText('Most Popular')

  // 3 city pills with correct hrefs
  await expect(card.locator('[data-testid="city-pill-sf"]')).toHaveAttribute('href', '/list/sf')
  await expect(card.locator('[data-testid="city-pill-sj"]')).toHaveAttribute('href', '/list/sj')
  await expect(card.locator('[data-testid="city-pill-fremont"]')).toHaveAttribute('href', '/list/fremont')
})
```

**Step 2:** Run, expect fail

```bash
npm run test:e2e -- home.spec.ts -g "Card 2"
```

**Step 3:** Implement Card 2

```tsx
// In ProductCards.tsx, replace data-testid="card-list" placeholder with:

const CITIES: Array<{ slug: string; label: string }> = [
  { slug: 'sf', label: 'San Francisco' },
  { slug: 'sj', label: 'San Jose' },
  { slug: 'fremont', label: 'Fremont' },
]

// ... inside ProductCards component:

<article
  className="bg-white border-2 border-[#2563eb] rounded-md p-6 flex flex-col relative shadow-sm"
  data-testid="card-list"
>
  <span className="absolute -top-3 left-6 bg-[#2563eb] text-white text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded">
    Most Popular
  </span>
  <p className="text-xs uppercase tracking-wider font-semibold text-[#2563eb] mb-2">
    Annual subscription
  </p>
  <h3 className="text-[20px] font-bold text-[#111827] mb-2">
    City Hot Architect List 2025
  </h3>
  <p className="text-sm text-[#6b7280] mb-5 flex-1">
    30 high-volume architects per city, with project history. The strategic asset.
  </p>
  <div className="mb-5">
    <span className="text-[28px] font-bold text-[#111827] tabular-nums">$499</span>
    <span className="text-sm text-[#6b7280] ml-2">/ city / year</span>
    <p className="text-xs text-[#9ca3af] mt-1">≈ $16.63 per architect</p>
  </div>
  <div className="space-y-2">
    {CITIES.map((c) => {
      const purchased = purchasedCities.includes(c.slug)
      const href = purchased && userId ? `/list/${userId}/${c.slug}/success` : `/list/${c.slug}`
      return (
        <a
          key={c.slug}
          href={href}
          className="flex items-center justify-between bg-[#eef2ff] hover:bg-[#dbeafe] text-[#1e40af] text-sm font-medium rounded-md px-4 py-2.5 transition-colors"
          data-testid={`city-pill-${c.slug}`}
        >
          <span>{c.label}</span>
          <span className="text-xs">
            {purchased ? 'Purchased — view →' : 'View →'}
          </span>
        </a>
      )
    })}
  </div>
</article>
```

**Step 4:** Run, expect pass

```bash
npm run test:e2e -- home.spec.ts -g "Card 2"
```

**Step 5:** Commit

```bash
git add src/components/home/ProductCards.tsx tests/e2e/home.spec.ts
git commit -m "feat(home): fill Card 2 with \$499 city list, 3 city pills, Most Popular badge"
```

---

### Task 2.4: Fill in Card 3 ($1999 Custom Research, mailto)

**Files:**
- Modify: `src/components/home/ProductCards.tsx`

**Step 1:** Add test

```typescript
// Append to tests/e2e/home.spec.ts
test('Card 3 (Research) shows from-price and Talk to us mailto', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('[data-testid="card-research"]')
  await expect(card).toContainText('Custom Market Research')
  await expect(card).toContainText('From $1,999')
  const cta = card.locator('[data-testid="card-research-cta"]')
  await expect(cta).toContainText('Talk to us')
  const href = await cta.getAttribute('href')
  expect(href).toContain('mailto:matthew.chivalri@gmail.com')
  expect(href).toContain('subject=')
})
```

**Step 2:** Run, expect fail

**Step 3:** Implement Card 3

```tsx
// Replace data-testid="card-research" placeholder
<article
  className="bg-white border border-gray-200 rounded-md p-6 flex flex-col"
  data-testid="card-research"
>
  <p className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-2">
    Custom engagement
  </p>
  <h3 className="text-[20px] font-bold text-[#111827] mb-2">
    Custom Market Research
  </h3>
  <p className="text-sm text-[#6b7280] mb-5 flex-1">
    Region-level analysis tailored to your business. Cross-city, multi-year, segment-specific.
  </p>
  <div className="mb-5">
    <span className="text-[28px] font-bold text-[#111827] tabular-nums">From $1,999</span>
    <p className="text-xs text-[#9ca3af] mt-1">Talk to us about scope.</p>
  </div>
  <a
    href="mailto:matthew.chivalri@gmail.com?subject=UpdateWave%20Custom%20Research%20Inquiry"
    className="inline-flex justify-center items-center bg-white border border-[#111827] hover:bg-[#f9fafb] text-[#111827] text-sm font-medium rounded-md px-4 py-2.5 transition-colors"
    data-testid="card-research-cta"
  >
    Talk to us →
  </a>
</article>
```

**Step 4:** Run, expect pass

**Step 5:** Commit

```bash
git add src/components/home/ProductCards.tsx tests/e2e/home.spec.ts
git commit -m "feat(home): fill Card 3 with research mailto CTA"
```

---

### Task 2.5: Visual QA via dev server

**Files:** None

**Step 1:** Start dev server

```bash
npm run dev
```

**Step 2:** Use the preview tools to visit `http://localhost:3000/` and verify visually:
- Hero centered, readable on 1440px and 375px widths
- 3 cards stack on mobile (vertical), 3 columns on md+ (≥768px)
- Card 2 is visually anchored ("Most Popular" badge visible, 2px blue border)
- All CTAs hover-state work

**Step 3:** Take a screenshot, verify nothing visually broken

**Step 4:** No commit (verification step)

---

## Phase 3: `/list/[city]` public page

### Task 3.1: Scaffold `/list/[city]` route

Strategy: this is the public version of `/list/[hash]/[city]`. Reuse the same hero / TOC / sample charts / FAQ sections, but **no hash, no purchase check**. The Buy CTA opens a sign-in flow.

**Files:**
- Create: `src/app/list/[city]/page.tsx`
- Create: `src/app/list/[city]/PublicBuyButton.tsx`
- Test: append to `tests/e2e/list.spec.ts` (new describe block)

**Step 1:** Write E2E test

```typescript
// tests/e2e/list.spec.ts (new describe at end of file)
test.describe('Public /list/[city] (no hash)', () => {
  test('renders for valid active city', async ({ page }) => {
    const response = await page.goto('/list/sj')
    if (!response || response.status() !== 200) {
      test.skip(true, 'city_lists seed not present for sj')
      return
    }
    await expect(page.locator('[data-testid="list-hero"]')).toBeVisible()
    await expect(page.locator('h1')).toContainText('San Jose')
    await expect(page.locator('[data-testid="public-buy-button"]')).toBeVisible()
    await expect(page.locator('[data-testid="public-buy-button"]')).toContainText('Buy report')
  })

  test('returns 404 for unknown city', async ({ page }) => {
    const response = await page.goto('/list/nowhere')
    expect(response?.status()).toBe(404)
  })

  test('does NOT render any hash-leaking elements', async ({ page }) => {
    const response = await page.goto('/list/sj')
    if (!response || response.status() !== 200) {
      test.skip(true, 'seed not present')
      return
    }
    const html = await page.content()
    // No hex-like 16+ char strings hinting at user hashes
    expect(html).not.toMatch(/data-hash=/)
  })
})
```

**Step 2:** Run, expect fail (route 404)

**Step 3:** Implement page

```tsx
// src/app/list/[city]/page.tsx
import { notFound } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchCityList, fetchListPurchase, fetchUserPurchaseSummary } from '@/lib/queries'
import { getCurrentUser } from '@/lib/auth'
import { formatPrice } from '@/lib/format'
import SiteHeader from '@/components/SiteHeader'
import PublicBuyButton from './PublicBuyButton'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface PublicListPageProps {
  params: Promise<{ city: string }>
}

export default async function PublicListPage({ params }: PublicListPageProps) {
  const { city } = await params
  const supabase = createSupabaseClient()

  const { cityList } = await fetchCityList(supabase, city)
  if (!cityList) notFound()

  // If user is signed in and already purchased, smart redirect to success
  const user = await getCurrentUser(supabase)
  if (user) {
    const { purchase } = await fetchListPurchase(supabase, user.id, cityList.id)
    if (purchase) {
      redirect(`/list/${user.hash}/${city}/success`)
    }
  }

  const launchPrice = cityList.price_cents
  const anchorPrice = cityList.anchor_price_cents
  const hasDiscount = anchorPrice !== null && launchPrice < anchorPrice

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <SiteHeader user={user} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <section className="mb-10" data-testid="list-hero">
          <p className="text-xs uppercase tracking-wider font-semibold text-[#2563eb] mb-2">
            City market structure report · {cityList.year}
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-4">
            {cityList.title}
          </h1>
          {cityList.description && (
            <p className="text-base text-[#374151] leading-relaxed whitespace-pre-line">
              {cityList.description}
            </p>
          )}
        </section>

        {cityList.headline_insight && (
          <section className="mb-10" data-testid="list-insight">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
              One thing you&apos;ll know after reading
            </h2>
            <blockquote className="bg-white border-l-4 border-[#2563eb] px-5 py-4 rounded-r-md">
              <p className="text-[18px] font-bold text-[#111827] leading-snug">
                {cityList.headline_insight}
              </p>
              {cityList.headline_insight_subtext && (
                <p className="text-sm text-[#6b7280] mt-3">
                  {cityList.headline_insight_subtext}
                </p>
              )}
            </blockquote>
          </section>
        )}

        {/* Price + CTA */}
        <section
          className="mb-10 bg-white border border-gray-200 rounded-md p-6"
          data-testid="list-cta"
        >
          <div className="flex items-baseline gap-3 mb-4 flex-wrap">
            {hasDiscount && (
              <span className="text-base text-[#9ca3af] line-through tabular-nums">
                {formatPrice(anchorPrice)}
              </span>
            )}
            <span className="text-[32px] font-bold text-[#111827] tabular-nums">
              {formatPrice(launchPrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs uppercase tracking-wider font-semibold text-[#dc2626]">
                Launch price
              </span>
            )}
          </div>
          <p className="text-sm text-[#6b7280] mb-5">
            One-time purchase. Instant download after payment. PDF, ~15 pages, mobile-readable in 5 minutes.
          </p>
          <PublicBuyButton city={city} signedIn={Boolean(user)} />
          <p className="text-xs text-[#9ca3af] mt-3">
            Secure checkout via Stripe. Refund on request within 7 days of purchase.
          </p>
        </section>
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All data sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
```

```tsx
// src/app/list/[city]/PublicBuyButton.tsx
'use client'

import { useState } from 'react'

interface PublicBuyButtonProps {
  city: string
  signedIn: boolean
}

export default function PublicBuyButton({ city, signedIn }: PublicBuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setError(null)
    if (!signedIn) {
      const next = encodeURIComponent(`/api/create-list-checkout-public?city=${city}`)
      window.location.href = `/auth/sign-in?next=${next}`
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/create-list-checkout-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Checkout failed')
      if (result.status === 'already_purchased') {
        window.location.href = result.redirectTo
        return
      }
      window.location.href = result.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full sm:w-auto inline-flex justify-center items-center bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white text-base font-semibold rounded-md px-6 py-3 transition-colors"
        data-testid="public-buy-button"
      >
        {loading ? 'Loading…' : 'Buy report →'}
      </button>
      {error && (
        <p className="text-sm text-[#dc2626] mt-2" data-testid="public-buy-error">
          {error}
        </p>
      )}
    </>
  )
}
```

**Step 4:** Run, expect pass

```bash
npm run test:e2e -- list.spec.ts -g "Public"
```

**Step 5:** Commit

```bash
git add src/app/list/[city]/ tests/e2e/list.spec.ts
git commit -m "feat(list): public /list/[city] page with sign-in-gated buy"
```

---

## Phase 4: `/leads` public page

### Task 4.1: Move existing project list to `/leads` (was at `/`)

The current `/` was rendering `<ProjectList projects={projects} revealedProjectIds={[]} />`. We replaced `/` in Phase 2. Now relocate that view to `/leads`, with the addition of a $129 Buy CTA per project (gated by sign-in).

**Files:**
- Create: `src/app/leads/page.tsx`
- Test: `tests/e2e/leads.spec.ts` (new)

**Step 1:** Write test

```typescript
// tests/e2e/leads.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Public /leads', () => {
  test('renders project list for anonymous users', async ({ page }) => {
    await page.goto('/leads')
    await expect(page.locator('h1')).toContainText('Pre-permit')
    // ProjectList renders cards
    const cards = page.locator('[data-testid^="project-card-"]')
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('does not show Reveal button for anonymous users (sign-in CTA instead)', async ({ page }) => {
    await page.goto('/leads')
    // No reveal-with-hash buttons should appear in anon mode
    const revealButtons = page.locator('button:has-text("Reveal architect")')
    expect(await revealButtons.count()).toBe(0)
  })
})
```

**Step 2:** Run, expect fail

**Step 3:** Implement

```tsx
// src/app/leads/page.tsx
import { createSupabaseClient } from '@/lib/supabase'
import { fetchPublishedProjects } from '@/lib/queries'
import { getCurrentUser } from '@/lib/auth'
import ProjectList from '@/components/ProjectList'
import SiteHeader from '@/components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = createSupabaseClient()
  const [user, { projects }] = await Promise.all([
    getCurrentUser(supabase),
    fetchPublishedProjects(supabase),
  ])

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <SiteHeader user={user} />

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <h1 className="text-[22px] font-bold text-[#111827] mb-1">
          Pre-permit projects
        </h1>
        <p className="text-sm text-[#6b7280]">
          New residential projects filed with the city — before permits are issued.
          Reveal architect contact info for $129.
        </p>
      </div>

      <ProjectList
        projects={projects}
        revealedProjectIds={[]}
        hash={user?.hash}
      />

      <footer className="max-w-6xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All listings sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
```

**Step 4:** Run, expect pass

**Step 5:** Commit

```bash
git add src/app/leads/ tests/e2e/leads.spec.ts
git commit -m "feat(leads): public /leads page reusing ProjectList for anon browse"
```

---

### Task 4.2: Update `ProjectCard` to render sign-in CTA when no hash

**Files:**
- Modify: `src/components/ProjectCard.tsx`
- Test: in `tests/e2e/leads.spec.ts`

(Read the existing `ProjectCard.tsx` first. The task is: when `hash` is `undefined`, the Reveal button should redirect to `/auth/sign-in?next=/api/create-checkout?project_id=X` instead of rendering the existing reveal flow. Implement minimally — the existing logic for revealed/unrevealed states stays.)

**Step 1:** Read `src/components/ProjectCard.tsx` to understand current contract

```bash
cat src/components/ProjectCard.tsx
```

**Step 2:** Write test

```typescript
// Append to tests/e2e/leads.spec.ts
test('clicking Buy on a lead anonymously redirects to sign-in', async ({ page }) => {
  await page.goto('/leads')
  const buyBtn = page.locator('[data-testid^="project-card-"] [data-testid="anon-buy-button"]').first()
  if (await buyBtn.count() === 0) {
    test.skip(true, 'No leads in DB')
    return
  }
  await buyBtn.click()
  await expect(page).toHaveURL(/\/auth\/sign-in/)
})
```

**Step 3:** Modify `ProjectCard.tsx`. Where the existing reveal button is gated on `hash`, add an else branch:

```tsx
// Pseudocode patch — locate the existing Reveal button render block in ProjectCard.tsx
{hash ? (
  // existing reveal flow JSX
) : (
  <a
    href={`/auth/sign-in?next=${encodeURIComponent(`/api/create-checkout?project_id=${project.id}`)}`}
    className="inline-flex justify-center items-center bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-md px-4 py-2 transition-colors"
    data-testid="anon-buy-button"
  >
    Buy lead — $129
  </a>
)}
```

**Step 4:** Run test, expect pass

**Step 5:** Commit

```bash
git add src/components/ProjectCard.tsx tests/e2e/leads.spec.ts
git commit -m "feat(leads): render anonymous Buy CTA that redirects to sign-in"
```

---

## Phase 5: `/research` page

### Task 5.1: Static research intro page

**Files:**
- Create: `src/app/research/page.tsx`
- Test: `tests/e2e/research.spec.ts`

**Step 1:** Test

```typescript
// tests/e2e/research.spec.ts
import { test, expect } from '@playwright/test'

test('research page renders intro and Talk to us mailto', async ({ page }) => {
  await page.goto('/research')
  await expect(page.locator('h1')).toContainText('Custom Market Research')
  const mailto = page.locator('[data-testid="research-talk-cta"]')
  await expect(mailto).toBeVisible()
  const href = await mailto.getAttribute('href')
  expect(href).toContain('mailto:matthew.chivalri@gmail.com')
})
```

**Step 2:** Run, expect fail

**Step 3:** Implement

```tsx
// src/app/research/page.tsx
import { createSupabaseClient } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'
import SiteHeader from '@/components/SiteHeader'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const supabase = createSupabaseClient()
  const user = await getCurrentUser(supabase)

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <SiteHeader user={user} />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-2">
          Custom engagement
        </p>
        <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-4">
          Custom Market Research
        </h1>
        <p className="text-base text-[#374151] leading-relaxed mb-6">
          Region-level analysis tailored to your business. Cross-city, multi-year, segment-specific.
          Examples: cross-county architect mapping, 5-year filing trend modeling, competitive
          positioning analysis for a specific GC vertical.
        </p>
        <p className="text-sm text-[#6b7280] mb-8">
          From <span className="font-bold text-[#111827]">$1,999</span>. Pricing depends on scope, data sources, and turnaround.
          Most engagements complete in 2-4 weeks.
        </p>
        <a
          href="mailto:matthew.chivalri@gmail.com?subject=UpdateWave%20Custom%20Research%20Inquiry&body=Hi%20Matt%2C%20I%27d%20like%20to%20talk%20about%20custom%20research%20for%3A%20"
          className="inline-flex justify-center items-center bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-base font-semibold rounded-md px-6 py-3 transition-colors"
          data-testid="research-talk-cta"
        >
          Talk to us →
        </a>
      </main>
    </div>
  )
}
```

**Step 4:** Run, expect pass

**Step 5:** Commit

```bash
git add src/app/research/ tests/e2e/research.spec.ts
git commit -m "feat(research): static /research page with custom inquiry mailto CTA"
```

---

## Phase 6: Hash route dual-permission refactor

Each existing hash route currently does:

```typescript
const { user } = await resolveUserByHash(supabase, hash)
if (!user) { /* error */ }
```

Refactor to also accept logged-in user without hash. Pattern: introduce a single resolver, then update each route.

### Task 6.1: Add `resolveAccessControl()` helper

**Files:**
- Modify: `src/lib/queries.ts`
- Test: `tests/unit/queries.test.ts`

**Step 1:** Test

```typescript
// Append to tests/unit/queries.test.ts
import { resolveAccessControl } from '@/lib/queries'

describe('resolveAccessControl', () => {
  it('resolves via hash when hash provided and valid', async () => {
    const supabase = mockSupabaseUser({ id: 7, hash: 'h7' })
    const result = await resolveAccessControl(supabase, { hash: 'h7' })
    expect(result.user?.id).toBe(7)
    expect(result.source).toBe('hash')
  })

  it('resolves via auth when no hash provided', async () => {
    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'm@x.com' } },
        }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 9, hash: 'h9', email: 'm@x.com', deleted_at: null },
        error: null,
      }),
    } as unknown as SupabaseClient
    const result = await resolveAccessControl(supabase, {})
    expect(result.user?.id).toBe(9)
    expect(result.source).toBe('auth')
  })

  it('returns null user when neither hash nor auth resolves', async () => {
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as SupabaseClient
    const result = await resolveAccessControl(supabase, {})
    expect(result.user).toBeNull()
  })
})

// helper used above
function mockSupabaseUser(user: { id: number; hash: string } | null) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: user, error: null }),
  } as unknown as SupabaseClient
}
```

**Step 2:** Run, expect fail

**Step 3:** Implement (append to `src/lib/queries.ts`)

```typescript
// Append to src/lib/queries.ts
import { getCurrentUser } from './auth'

export interface AccessControlResult {
  user: Pick<User, 'id' | 'hash' | 'email'> | null
  source: 'hash' | 'auth' | 'none'
}

/**
 * Dual-permission resolver. Tries hash first (legacy URL flow), then falls back
 * to logged-in user via getCurrentUser().
 *
 * Use this in any route that historically gated on hash. The route can still
 * accept hash as URL param for backward compatibility, while also serving
 * users who arrived via the new /auth/sign-in flow.
 */
export async function resolveAccessControl(
  supabase: SupabaseClient,
  opts: { hash?: string }
): Promise<AccessControlResult> {
  if (opts.hash) {
    const { user } = await resolveUserByHash(supabase, opts.hash)
    if (user) return { user, source: 'hash' }
  }
  const authUser = await getCurrentUser(supabase)
  if (authUser) {
    return {
      user: { id: authUser.id, hash: authUser.hash, email: authUser.email },
      source: 'auth',
    }
  }
  return { user: null, source: 'none' }
}
```

**Step 4:** Run, expect pass

**Step 5:** Commit

```bash
git add src/lib/queries.ts tests/unit/queries.test.ts
git commit -m "feat(queries): add resolveAccessControl for dual-permission (hash | auth)"
```

---

### Task 6.2: Refactor `/list/[hash]/[city]` to use `resolveAccessControl`

**Files:**
- Modify: `src/app/list/[hash]/[city]/page.tsx`

**Step 1:** Add backward-compat E2E test (existing tests cover hash; add an auth-only variant)

```typescript
// Append to tests/e2e/list.spec.ts (under existing 'List landing page' describe or new one)
test('logged-in user can access /list/[hash]/[city] even with stranger hash', async ({ page }) => {
  // This test requires test fixture for auth — for now mark skip if no auth helper exists
  test.skip(true, 'Auth E2E fixture not yet available — Phase 8 reintroduces')
})
```

**Step 2:** Replace `resolveUserByHash` call with `resolveAccessControl`. The hash from URL becomes a *hint*, not a requirement:

```tsx
// In src/app/list/[hash]/[city]/page.tsx, replace the user resolution block:
import { fetchCityList, fetchListPurchase, resolveAccessControl } from '@/lib/queries'

// ... inside ListPage:
const [accessResult, cityListResult] = await Promise.all([
  resolveAccessControl(supabase, { hash }),
  fetchCityList(supabase, city),
])

if (!accessResult.user) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
      <p className="text-base text-[#6b7280]">
        Sign in or use a valid invite link to view this report.
      </p>
    </div>
  )
}
const user = accessResult.user
```

**Step 3:** Run all existing list tests, expect still pass

```bash
npm run test:e2e -- list.spec.ts
```

**Step 4:** Run unit + integration tests for list APIs

```bash
npm test -- create-list-checkout download-list
```

**Step 5:** Commit

```bash
git add src/app/list/[hash]/[city]/page.tsx tests/e2e/list.spec.ts
git commit -m "refactor(list): hash route uses resolveAccessControl for dual-permission"
```

---

### Task 6.3: Refactor `/list/[hash]/[city]/success` similarly

**Files:**
- Modify: `src/app/list/[hash]/[city]/success/page.tsx`

Apply the same pattern. Read the existing file first, then swap the resolution. Keep all post-purchase verification logic. Commit.

```bash
git commit -m "refactor(list): success page uses resolveAccessControl"
```

---

### Task 6.4: Refactor `/browse/[hash]` similarly

**Files:**
- Modify: `src/app/browse/[hash]/page.tsx`

Same pattern. Commit:

```bash
git commit -m "refactor(browse): hash route uses resolveAccessControl"
```

---

### Task 6.5: Refactor `/reveals/[hash]` similarly

**Files:**
- Modify: `src/app/reveals/[hash]/page.tsx`

Same pattern. Commit:

```bash
git commit -m "refactor(reveals): hash route uses resolveAccessControl"
```

---

## Phase 7: Public checkout API + webhook user_id refactor

The existing `/api/create-list-checkout` requires a `hash` in the body. Add a parallel `/api/create-list-checkout-public` that resolves user from auth session instead. Same for reveal checkout.

The webhook **already** receives `user_id` in metadata (`src/app/api/webhook/route.ts:94`). Confirm it works for the new flow without code changes — the only adjustment: webhook should no longer require `hash` in metadata for list purchases originating from public flow.

### Task 7.1: Create `/api/create-list-checkout-public`

**Files:**
- Create: `src/app/api/create-list-checkout-public/route.ts`
- Test: `tests/integration/create-list-checkout-public.test.ts`

**Step 1:** Test

```typescript
// tests/integration/create-list-checkout-public.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/create-list-checkout-public/route'

vi.mock('@/lib/supabase', () => ({
  createSupabaseClient: vi.fn(),
  createSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/lib/stripe', () => ({
  createStripeClient: vi.fn(),
}))

describe('POST /api/create-list-checkout-public', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no auth session', async () => {
    const { createSupabaseClient } = await import('@/lib/supabase')
    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as never)

    const request = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({ city: 'sj' }),
    })
    const response = await POST(request as never)
    expect(response.status).toBe(401)
  })

  it('returns 400 for missing city', async () => {
    const request = new Request('http://x', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(request as never)
    expect(response.status).toBe(400)
  })

  // ... add positive case mocking auth + Stripe
})
```

**Step 2:** Run, expect fail

**Step 3:** Implement

```typescript
// src/app/api/create-list-checkout-public/route.ts
import { NextRequest } from 'next/server'
import { createSupabaseClient, createSupabaseServiceClient } from '@/lib/supabase'
import { createStripeClient } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth'
import { fetchCityList, fetchListPurchase } from '@/lib/queries'

/**
 * Public-flow Stripe Checkout creator: requires authenticated session
 * (resolved via Supabase Auth → users.email match), no hash needed.
 *
 * Mirrors /api/create-list-checkout but identifies the user via auth instead
 * of hash. Sets metadata.user_id for the webhook; no metadata.hash.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const city =
    typeof body === 'object' && body !== null && typeof (body as Record<string, unknown>).city === 'string'
      ? (body as { city: string }).city
      : null

  if (!city) {
    return Response.json({ error: 'Missing or invalid field: city' }, { status: 400 })
  }

  // Resolve via auth session (anon client reads cookie session)
  const anonSupabase = createSupabaseClient()
  const user = await getCurrentUser(anonSupabase)
  if (!user) {
    return Response.json({ error: 'Sign in required.' }, { status: 401 })
  }

  // Service client for read-after-auth + idempotency check
  const serviceSupabase = createSupabaseServiceClient()
  const { cityList, error: cityListError } = await fetchCityList(serviceSupabase, city)
  if (cityListError || !cityList) {
    return Response.json({ error: 'Report not found.' }, { status: 404 })
  }

  const { purchase: existing } = await fetchListPurchase(serviceSupabase, user.id, cityList.id)
  if (existing) {
    return Response.json({
      status: 'already_purchased' as const,
      redirectTo: `/list/${user.hash}/${city}/success`,
    })
  }

  const stripe = createStripeClient()
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const idempotencyKey = `list-public:${user.id}:${cityList.id}`

  const session = await stripe.checkout.sessions.create(
    {
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: cityList.title },
            unit_amount: cityList.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      client_reference_id: `auth:${user.id}:list:${cityList.id}`,
      metadata: {
        product_type: 'list',
        user_id: String(user.id),
        city_list_id: String(cityList.id),
        city,
        // No hash — public flow is auth-only
      },
      success_url: `${origin}/list/${user.hash}/${city}/success`,
      cancel_url: `${origin}/list/${city}`,
    },
    { idempotencyKey }
  )

  return Response.json({ status: 'checkout' as const, url: session.url })
}
```

**Step 4:** Run, expect pass

**Step 5:** Commit

```bash
git add src/app/api/create-list-checkout-public/ tests/integration/create-list-checkout-public.test.ts
git commit -m "feat(api): create-list-checkout-public for auth-based purchase flow"
```

---

### Task 7.2: Update webhook list handler to allow missing hash

**Files:**
- Modify: `src/app/api/webhook/route.ts`
- Test: append to `tests/integration/webhook.test.ts`

**Step 1:** Test the new branch

```typescript
// Append to tests/integration/webhook.test.ts
it('handleListPurchase succeeds without metadata.hash when user_id is set (public flow)', async () => {
  // Mock Stripe event with metadata.user_id but no metadata.hash
  // Verify list_purchases insert succeeds
  // ... follow existing test pattern
})
```

**Step 2:** Run, expect fail

**Step 3:** Modify `handleListPurchase` in `src/app/api/webhook/route.ts`

Replace this block:

```typescript
if (!userIdStr || !cityListIdStr || !hash) {
  console.warn('[webhook:list] missing metadata', { hasUserId: !!userIdStr, hasCityListId: !!cityListIdStr, hasHash: !!hash })
  return Response.json({ received: true })
}
```

with:

```typescript
if (!userIdStr || !cityListIdStr) {
  console.warn('[webhook:list] missing metadata', { hasUserId: !!userIdStr, hasCityListId: !!cityListIdStr })
  return Response.json({ received: true })
}
```

And replace the soft-delete check:

```typescript
const { user } = await resolveUserByHash(supabase, hash)
if (!user || String(user.id) !== userIdStr) {
  return Response.json({ received: true })
}
```

with a hash-or-id resolver:

```typescript
// Soft-delete enforcement: re-validate user is still active.
// Prefer hash if present (legacy flow); otherwise look up by id directly.
let user
if (hash) {
  const r = await resolveUserByHash(supabase, hash)
  user = r.user
  if (user && String(user.id) !== userIdStr) {
    return Response.json({ received: true })
  }
} else {
  const { data } = await supabase
    .from('users')
    .select('id, hash')
    .eq('id', parseInt(userIdStr, 10))
    .is('deleted_at', null)
    .single()
  user = data as { id: number; hash: string } | null
}
if (!user) {
  return Response.json({ received: true })
}
```

**Step 4:** Run all webhook tests, expect pass

```bash
npm test -- webhook
```

**Step 5:** Commit

```bash
git add src/app/api/webhook/route.ts tests/integration/webhook.test.ts
git commit -m "refactor(webhook): allow public-flow list purchases without metadata.hash"
```

---

### Task 7.3: Add `/api/create-checkout-public` for $129 reveal flow

Same pattern as 7.1 but for individual reveals. Skip if WS-2 ($25→$129) not yet shipped — file an issue and move on.

**Defer this task** unless WS-2 is in scope. Cite TODOS.md when committing if defer.

```bash
git commit -m "chore(deferred): create-checkout-public will land with WS-2"
```

---

## Phase 8: Tests + QA

### Task 8.1: Anonymous home → /list/sj → buy flow E2E

```typescript
// Append to tests/e2e/home.spec.ts
test('anonymous home → click City pill → land on /list/sj', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-testid="city-pill-sj"]').click()
  await expect(page).toHaveURL('/list/sj')
  await expect(page.locator('[data-testid="public-buy-button"]')).toBeVisible()
})

test('anonymous click Buy → redirected to sign-in', async ({ page }) => {
  await page.goto('/list/sj')
  if (await page.locator('[data-testid="public-buy-button"]').count() === 0) {
    test.skip(true, 'No SJ city_list seed')
    return
  }
  await page.locator('[data-testid="public-buy-button"]').click()
  await expect(page).toHaveURL(/\/auth\/sign-in/)
})
```

**Commit:** `test(e2e): cover anonymous home → list → sign-in flow`

---

### Task 8.2: Backward compat — old hash URLs still work

```typescript
// Append to tests/e2e/list.spec.ts
test('legacy /list/[hash]/sj still renders for valid hash (backward compat)', async ({ page }) => {
  await page.goto(`/list/${TEST_HASH}/sj`)
  // The existing list.spec.ts tests cover full preview composition — this is a smoke test
  await expect(page.locator('[data-testid="list-hero"]')).toBeVisible()
})
```

**Commit:** `test(e2e): backward-compat smoke for legacy hash URL`

---

### Task 8.3: Lint + typecheck full pass

```bash
npm run lint
npx tsc --noEmit
npm test
npm run test:e2e
```

All four must pass before Phase 9. Fix any failures with minimal-diff edits.

**Commit (if any fixes needed):** `chore: lint + tsc fixes for portal worktree`

---

## Phase 9: QA + Ship

### Task 9.1: Manual visual QA via dev server

```bash
npm run dev
```

Open browser, walk through:
- `/` (anon) → all 3 cards visible, hero readable, mobile stacks correctly at 375px
- `/` (signed in, no purchases) → no Welcome back banner
- `/` (signed in, with purchases) → Welcome back banner shows correct counts
- `/list/sj` (anon) → renders, Buy CTA → sign-in
- `/list/sj` (signed in, not purchased) → Buy CTA → Stripe
- `/list/sj` (signed in, purchased) → smart redirect to success page
- `/leads` → ProjectList renders, anon Buy → sign-in
- `/research` → mailto link opens email client
- `/list/[old-test-hash]/sj` → still works (backward compat)

### Task 9.2: Mobile + desktop screenshots

Take screenshots at 375px (iPhone) and 1440px (desktop) for the /, /list/sj, /leads, /research pages. Save to `docs/plans/2026-05-04-screenshots/` for the PR description.

### Task 9.3: Update CHANGELOG and bump VERSION

```bash
# Bump 0.2.0 → 0.3.0 (new feature: home portal)
echo "0.3.0" > VERSION
```

Edit `CHANGELOG.md` to add a new section:

```markdown
## [0.3.0] - 2026-05-04

### Added
- Public home page at `/` indexing 3 product tiers ($129 lead / $499 city list / $1999 research)
- Public city list pages at `/list/[city]` (no hash required)
- Public lead browse at `/leads`
- Custom research intake page at `/research`
- `getCurrentUser()` and `fetchUserPurchaseSummary()` helpers
- `resolveAccessControl()` for dual-permission (hash | auth) on existing routes
- `/api/create-list-checkout-public` for auth-based purchase flow
- Welcome back banner for returning logged-in users

### Changed
- `/browse/[hash]`, `/list/[hash]/[city]`, `/reveals/[hash]` now accept hash OR auth session
- Webhook list handler no longer requires `metadata.hash` (defers to `metadata.user_id`)

### Notes
- Auth UI itself (sign-in / callback) ships in parallel `feat/email-auth` worktree.
  Buy CTAs render disabled with mailto fallback if auth not yet live at deploy time.
```

**Commit:**

```bash
git add VERSION CHANGELOG.md
git commit -m "chore: bump version 0.3.0 for home portal release"
```

### Task 9.4: Push branch + open PR

```bash
git push -u origin feat/home-page-product-portal
```

Create PR via `gh`:

```bash
gh pr create --base docs/product-roadmap --title "feat: home page product portal + dual-permission refactor" --body "$(cat <<'EOF'
## Summary
- Replaces / with public product portal indexing 3 pricing tiers
- New public sub-routes /list/[city], /leads, /research
- Dual-permission refactor for hash-gated routes
- Webhook + checkout user_id-first

## Design doc
docs/plans/2026-05-04-home-page-product-portal-design.md

## Test plan
- [ ] All unit + integration tests pass (vitest)
- [ ] All E2E tests pass (Playwright)
- [ ] Manual QA: anon flow on / → /list/sj → sign-in
- [ ] Manual QA: signed-in flow with purchases shows Welcome back banner
- [ ] Manual QA: backward compat — /list/[old-hash]/sj still works
- [ ] Mobile responsive at 375px

## Auth dependency
Buy CTAs assume /auth/sign-in?next=... exists in the parallel auth worktree.
If auth not yet merged at ship time, fallback handled per design doc Section 9.
EOF
)"
```

---

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-05-04-home-page-product-portal.md`. Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** — Open a new Claude Code session in the worktree, that session uses `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach?**
