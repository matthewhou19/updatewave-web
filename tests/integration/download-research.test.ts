import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_USER = { id: 1, hash: 'test_hash_123' }
const TEST_RESEARCH_CITY_LIST = {
  id: 7,
  city: 'sj',
  year: 2025,
  title: 'San Jose 2025 Custom Research + 90-Day Permit Monitoring',
  description: 'desc',
  headline_insight: null,
  headline_insight_subtext: null,
  price_cents: 199900,
  anchor_price_cents: null,
  active: true,
  service_tier: 'research',
  delivery_window_days: null,
  pdf_storage_path: 'sj-2025.pdf',
  created_at: '2026-05-04T00:00:00Z',
  updated_at: '2026-05-04T00:00:00Z',
}

const TEST_DELIVERED_PURCHASE = {
  id: 11,
  user_id: 1,
  city_list_id: 7,
  stripe_session_id: 'cs_test',
  stripe_payment_id: 'pi_test',
  amount_cents: 199900,
  delivery_status: 'delivered',
  digest_subscription_until: '2026-08-02T00:00:00Z',
  purchased_at: '2026-05-04T00:00:00Z',
  delivered_at: '2026-05-04T00:00:00Z',
}

const TEST_PENDING_PURCHASE = {
  ...TEST_DELIVERED_PURCHASE,
  delivery_status: 'pending',
  delivered_at: null,
}

function createMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  const storage = {
    from: vi.fn().mockReturnThis(),
    createSignedUrl: vi.fn(),
  }
  return {
    from: vi.fn(() => ({ ...chain })),
    storage,
    _chain: chain,
    _storage: storage,
  }
}

let mockSupabase: ReturnType<typeof createMockSupabase>

vi.mock('@/lib/supabase', () => ({
  createSupabaseServiceClient: () => mockSupabase,
}))

const { GET } = await import('../../src/app/api/download-research/[hash]/[city]/route')

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/download-research/h/sj', {
    method: 'GET',
  })
}

function makeParams(hash: string, city: string) {
  return { params: Promise.resolve({ hash, city }) }
}

describe('GET /api/download-research/[hash]/[city]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
  })

  it('returns 400 when hash or city missing in URL params', async () => {
    const res = await GET(makeRequest(), makeParams('', 'sj'))
    expect(res.status).toBe(400)
  })

  it('returns 403 for invalid hash', async () => {
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const res = await GET(makeRequest(), makeParams('bad', 'sj'))
    expect(res.status).toBe(403)
  })

  it('returns 403 for soft-deleted user (regression)', async () => {
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(403)
    expect(mockSupabase._chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns 404 for unknown city (no research-tier row)', async () => {
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'unknown'))
    expect(res.status).toBe(404)
  })

  it('returns 404 when user has not purchased (no info leak)', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })
    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not purchased.')
  })

  it('returns 404 when purchase exists but delivery_status is not delivered', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_PENDING_PURCHASE, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })
    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Research not yet delivered.')
  })

  it('returns signed URL when delivered owner requests download', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_DELIVERED_PURCHASE, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })

    mockSupabase._storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase/signed?token=research' },
      error: null,
    })

    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://supabase/signed?token=research')

    expect(mockSupabase.storage.from).toHaveBeenCalledWith('city-lists-pdfs')
    expect(mockSupabase._storage.createSignedUrl).toHaveBeenCalledWith('sj-2025.pdf', 7200)
  })

  it('sets Cache-Control: no-store on the response', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_DELIVERED_PURCHASE, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })

    mockSupabase._storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase/signed?token=research' },
      error: null,
    })

    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('returns 500 when Storage signing fails', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_DELIVERED_PURCHASE, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })

    mockSupabase._storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'storage backend down' },
    })

    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(500)
  })
})
