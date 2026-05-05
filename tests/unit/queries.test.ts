import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchCityList,
  fetchCityListWithStoragePath,
  fetchListPurchase,
  fetchUserByHash,
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
}

function makeChain(overrides: ChainStubs = {}) {
  const chain = {
    select: overrides.select ?? vi.fn().mockReturnThis(),
    eq: overrides.eq ?? vi.fn().mockReturnThis(),
    is: overrides.is ?? vi.fn().mockReturnThis(),
    single: overrides.single ?? vi.fn(),
    maybeSingle: overrides.maybeSingle ?? vi.fn(),
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

describe('fetchUserByHash (regression: deleted_at filter)', () => {
  it('applies deleted_at IS NULL so a soft-deleted user is not returned', async () => {
    const chain = makeChain()
    chain.maybeSingle.mockResolvedValue({ data: null, error: null })
    const supabase = makeSupabase(chain)

    const { user } = await fetchUserByHash(supabase, 'deleted-user-hash')

    expect(user).toBeNull()
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(chain.eq).toHaveBeenCalledWith('hash', 'deleted-user-hash')
  })

  it('returns the user when the hash matches an active row', async () => {
    const chain = makeChain()
    chain.maybeSingle.mockResolvedValue({
      data: {
        id: 1,
        hash: 'active',
        email: 'user@example.com',
        deleted_at: null,
        auth_user_id: null,
      },
      error: null,
    })
    const supabase = makeSupabase(chain)

    const { user } = await fetchUserByHash(supabase, 'active')
    expect(user?.id).toBe(1)
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
