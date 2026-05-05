import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  RESEARCH_PURCHASE_PUBLIC_COLUMNS,
  createDigestSubscription,
  fetchActiveResearchCities,
  fetchCityList,
  fetchCityListWithStoragePath,
  fetchListPurchase,
  fetchListPurchaseForCollisionCheck,
  fetchResearchPurchase,
  resolveUserByHash,
} from '../../src/lib/queries'

/**
 * Unit tests for the new query helpers.
 *
 * The helpers are thin wrappers over Supabase query chains. We mock the
 * chainable `.from().select().eq().is().single()` methods and assert:
 *   1. The right table is queried
 *   2. The right filters are applied (especially deleted_at IS NULL)
 *   3. The right column list is selected (security: pdf_storage_path
 *      must NOT appear in the public column list)
 *   4. The data is returned cleanly
 */

interface ChainStubs {
  select?: ReturnType<typeof vi.fn>
  eq?: ReturnType<typeof vi.fn>
  is?: ReturnType<typeof vi.fn>
  single?: ReturnType<typeof vi.fn>
  maybeSingle?: ReturnType<typeof vi.fn>
  order?: ReturnType<typeof vi.fn>
  insert?: ReturnType<typeof vi.fn>
}

function makeChain(overrides: ChainStubs = {}) {
  const chain = {
    select: overrides.select ?? vi.fn().mockReturnThis(),
    eq: overrides.eq ?? vi.fn().mockReturnThis(),
    is: overrides.is ?? vi.fn().mockReturnThis(),
    single: overrides.single ?? vi.fn(),
    maybeSingle: overrides.maybeSingle ?? vi.fn(),
    order: overrides.order ?? vi.fn(),
    insert: overrides.insert ?? vi.fn().mockReturnThis(),
  }
  return chain
}

function makeSupabase(chain: ReturnType<typeof makeChain>): SupabaseClient {
  return {
    from: vi.fn(() => chain),
  } as unknown as SupabaseClient
}

describe('resolveUserByHash', () => {
  it('queries users table with hash and deleted_at IS NULL filter', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: { id: 7, hash: 'h1' },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { user, error } = await resolveUserByHash(supabase, 'h1')

    expect(supabase.from).toHaveBeenCalledWith('users')
    expect(chain.eq).toHaveBeenCalledWith('hash', 'h1')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(user).toEqual({ id: 7, hash: 'h1' })
    expect(error).toBeNull()
  })

  it('returns null user when supabase returns null (deleted or missing)', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'not found' },
    })
    const supabase = makeSupabase(chain)

    const { user } = await resolveUserByHash(supabase, 'nope')
    expect(user).toBeNull()
  })

  it('treats a soft-deleted user as not found (regression: deleted_at filter must apply)', async () => {
    // Simulating the Postgres response when deleted_at filter excludes the row:
    // single() returns { data: null, error: PGRST116 not-found }. The helper
    // must surface null without leaking the deleted user.
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const supabase = makeSupabase(chain)

    const { user } = await resolveUserByHash(supabase, 'deleted-user-hash')
    expect(user).toBeNull()
    // Critical: the helper called .is('deleted_at', null) on the chain
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  })
})

describe('fetchCityList', () => {
  it('queries city_lists by city + active=true with public columns only', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: {
        id: 1,
        city: 'sj',
        year: 2025,
        title: 'San Jose 2025',
        description: 'desc',
        price_cents: 34900,
        active: true,
        created_at: '2026-04-28T00:00:00Z',
        updated_at: '2026-04-28T00:00:00Z',
      },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { cityList } = await fetchCityList(supabase, 'sj')

    expect(supabase.from).toHaveBeenCalledWith('city_lists')
    // First select call should be the public column list (no pdf_storage_path)
    const selectArg = chain.select.mock.calls[0][0] as string
    expect(selectArg).not.toContain('pdf_storage_path')
    expect(selectArg).toContain('city')
    expect(selectArg).toContain('price_cents')
    expect(chain.eq).toHaveBeenCalledWith('city', 'sj')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(cityList?.city).toBe('sj')
  })

  it('returns null when city not found', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const supabase = makeSupabase(chain)

    const { cityList } = await fetchCityList(supabase, 'unknown')
    expect(cityList).toBeNull()
  })

  it('returns null when city exists but active=false (filter applied)', async () => {
    // Same shape as not-found: chain filters on active=true so inactive rows
    // simply do not match. Helper does NOT post-filter.
    const chain = makeChain()
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const supabase = makeSupabase(chain)

    await fetchCityList(supabase, 'inactive-city')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
  })
})

describe('fetchCityListWithStoragePath', () => {
  it('SELECT must include pdf_storage_path (server-side use only)', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: {
        id: 1,
        city: 'sj',
        year: 2025,
        title: 'San Jose 2025',
        description: null,
        price_cents: 34900,
        active: true,
        created_at: '2026-04-28T00:00:00Z',
        updated_at: '2026-04-28T00:00:00Z',
        pdf_storage_path: 'sj-2025.pdf',
      },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { cityList } = await fetchCityListWithStoragePath(supabase, 'sj')

    const selectArg = chain.select.mock.calls[0][0] as string
    expect(selectArg).toContain('pdf_storage_path')
    expect(cityList?.pdf_storage_path).toBe('sj-2025.pdf')
  })
})

describe('fetchListPurchase', () => {
  it('returns purchase row when present', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: {
        id: 5,
        user_id: 7,
        city_list_id: 1,
        stripe_session_id: 'cs_test',
        stripe_payment_id: 'pi_test',
        amount_cents: 34900,
        purchased_at: '2026-04-28T01:00:00Z',
      },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { purchase } = await fetchListPurchase(supabase, 7, 1)

    expect(supabase.from).toHaveBeenCalledWith('list_purchases')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 7)
    expect(chain.eq).toHaveBeenCalledWith('city_list_id', 1)
    expect(purchase?.id).toBe(5)
  })

  it('returns null when no purchase exists', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const supabase = makeSupabase(chain)

    const { purchase } = await fetchListPurchase(supabase, 99, 1)
    expect(purchase).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// Migration 003 helpers: research purchases + digest subscriptions
// ─────────────────────────────────────────────────────────────────────────

describe('RESEARCH_PURCHASE_PUBLIC_COLUMNS', () => {
  it('includes only safe-to-expose columns', () => {
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('id')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('user_id')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('city_list_id')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('stripe_session_id')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('delivery_status')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('digest_subscription_until')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('purchased_at')
    expect(RESEARCH_PURCHASE_PUBLIC_COLUMNS).toContain('delivered_at')
  })
})

describe('fetchActiveResearchCities', () => {
  it('queries city_lists with active=true AND service_tier=research, ordered by city', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({
      data: [
        {
          id: 2,
          city: 'fremont',
          year: 2026,
          title: 'Fremont 2026 Custom Research',
          description: null,
          headline_insight: null,
          headline_insight_subtext: null,
          price_cents: 199900,
          anchor_price_cents: null,
          active: true,
          service_tier: 'research',
          delivery_window_days: 10,
          created_at: '2026-05-04T00:00:00Z',
          updated_at: '2026-05-04T00:00:00Z',
        },
      ],
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { cityLists, error } = await fetchActiveResearchCities(supabase)

    expect(supabase.from).toHaveBeenCalledWith('city_lists')
    // Public columns selected (no pdf_storage_path)
    const selectArg = chain.select.mock.calls[0][0] as string
    expect(selectArg).not.toContain('pdf_storage_path')
    expect(selectArg).toContain('service_tier')
    expect(selectArg).toContain('delivery_window_days')
    expect(chain.eq).toHaveBeenCalledWith('active', true)
    expect(chain.eq).toHaveBeenCalledWith('service_tier', 'research')
    expect(chain.order).toHaveBeenCalledWith('city', { ascending: true })
    expect(cityLists).toHaveLength(1)
    expect(cityLists[0].city).toBe('fremont')
    expect(cityLists[0].service_tier).toBe('research')
    expect(error).toBeNull()
  })

  it('returns empty array when no research-tier cities are active', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: [], error: null })
    const supabase = makeSupabase(chain)

    const { cityLists } = await fetchActiveResearchCities(supabase)
    expect(cityLists).toEqual([])
  })

  it('returns empty array when supabase returns null data', async () => {
    const chain = makeChain()
    chain.order.mockResolvedValue({ data: null, error: null })
    const supabase = makeSupabase(chain)

    const { cityLists } = await fetchActiveResearchCities(supabase)
    expect(cityLists).toEqual([])
  })
})

describe('fetchResearchPurchase', () => {
  it('queries research_purchases by user_id + city_list_id with public columns', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: {
        id: 11,
        user_id: 7,
        city_list_id: 2,
        stripe_session_id: 'cs_research_test',
        stripe_payment_id: 'pi_research_test',
        amount_cents: 199900,
        delivery_status: 'pending',
        digest_subscription_until: '2026-08-02T00:00:00Z',
        purchased_at: '2026-05-04T00:00:00Z',
        delivered_at: null,
      },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { purchase, error } = await fetchResearchPurchase(supabase, 7, 2)

    expect(supabase.from).toHaveBeenCalledWith('research_purchases')
    const selectArg = chain.select.mock.calls[0][0] as string
    expect(selectArg).toBe(RESEARCH_PURCHASE_PUBLIC_COLUMNS)
    expect(chain.eq).toHaveBeenCalledWith('user_id', 7)
    expect(chain.eq).toHaveBeenCalledWith('city_list_id', 2)
    expect(purchase?.id).toBe(11)
    expect(purchase?.delivery_status).toBe('pending')
    expect(error).toBeNull()
  })

  it('returns null when no research purchase exists', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const supabase = makeSupabase(chain)

    const { purchase } = await fetchResearchPurchase(supabase, 99, 2)
    expect(purchase).toBeNull()
  })
})

describe('fetchListPurchaseForCollisionCheck', () => {
  it('returns owns=true when an existing list_purchases row is present', async () => {
    const chain = makeChain()
    chain.maybeSingle.mockResolvedValue({ data: { id: 5 }, error: null })
    const supabase = makeSupabase(chain)

    const { owns, error } = await fetchListPurchaseForCollisionCheck(supabase, 7, 1)

    expect(supabase.from).toHaveBeenCalledWith('list_purchases')
    // SELECT only the id — collision check needs presence, not full row
    const selectArg = chain.select.mock.calls[0][0] as string
    expect(selectArg).toBe('id')
    expect(chain.eq).toHaveBeenCalledWith('user_id', 7)
    expect(chain.eq).toHaveBeenCalledWith('city_list_id', 1)
    expect(owns).toBe(true)
    expect(error).toBeNull()
  })

  it('returns owns=false when no list_purchases row exists', async () => {
    const chain = makeChain()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const supabase = makeSupabase(chain)

    const { owns } = await fetchListPurchaseForCollisionCheck(supabase, 7, 1)
    expect(owns).toBe(false)
  })
})

describe('createDigestSubscription', () => {
  it('inserts row with generated unsubscribe_token and active=true', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: {
        id: 1,
        research_purchase_id: 11,
        city: 'fremont',
        unsubscribe_token: 'mocked-uuid',
        active: true,
        unsubscribed_at: null,
        last_sent_at: null,
        created_at: '2026-05-04T00:00:00Z',
      },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { subscription, error } = await createDigestSubscription(supabase, 11, 'fremont')

    expect(supabase.from).toHaveBeenCalledWith('digest_subscriptions')
    // Insert payload includes the generated unsubscribe_token + active=true
    const insertArg = chain.insert.mock.calls[0][0] as Record<string, unknown>
    expect(insertArg.research_purchase_id).toBe(11)
    expect(insertArg.city).toBe('fremont')
    expect(typeof insertArg.unsubscribe_token).toBe('string')
    // crypto.randomUUID() format: 8-4-4-4-12 hex digits
    expect(insertArg.unsubscribe_token as string).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
    expect(insertArg.active).toBe(true)
    expect(subscription?.id).toBe(1)
    expect(error).toBeNull()
  })

  it('generates a different token on each call (random, not constant)', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({ data: {}, error: null })
    const supabase = makeSupabase(chain)

    await createDigestSubscription(supabase, 11, 'fremont')
    await createDigestSubscription(supabase, 12, 'oakland')

    const tokenA = (chain.insert.mock.calls[0][0] as Record<string, unknown>).unsubscribe_token
    const tokenB = (chain.insert.mock.calls[1][0] as Record<string, unknown>).unsubscribe_token
    expect(tokenA).not.toBe(tokenB)
  })

  it('surfaces supabase error when insert fails', async () => {
    const chain = makeChain()
    chain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'unique violation on unsubscribe_token' },
    })
    const supabase = makeSupabase(chain)

    const { subscription, error } = await createDigestSubscription(supabase, 11, 'fremont')
    expect(subscription).toBeNull()
    expect(error).toMatchObject({ code: '23505' })
  })
})
