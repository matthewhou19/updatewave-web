import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_USER = { id: 1, hash: 'test_hash_123' }
const TEST_RESEARCH_CITY_LIST = {
  id: 7,
  city: 'sj',
  year: 2025,
  title: 'San Jose 2025 Custom Research + 90-Day Permit Monitoring',
  description: 'Full report + monitoring',
  headline_insight: null,
  headline_insight_subtext: null,
  price_cents: 199900,
  anchor_price_cents: null,
  active: true,
  service_tier: 'research',
  delivery_window_days: null,
  created_at: '2026-05-04T00:00:00Z',
  updated_at: '2026-05-04T00:00:00Z',
}

function createMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  }
  return {
    from: vi.fn(() => ({ ...chain })),
    _chain: chain,
  }
}

let mockSupabase: ReturnType<typeof createMockSupabase>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockStripeCreate: any

vi.mock('@/lib/supabase', () => ({
  createSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/stripe', () => ({
  createStripeClient: () => ({
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockStripeCreate(...args),
      },
    },
  }),
  ensureStripeConfigured: () => null,
}))

const { POST } = await import('../../src/app/api/create-research-checkout/route')

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/create-research-checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/create-research-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    mockStripeCreate = vi.fn()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-research-checkout', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when hash or city missing', async () => {
    const res = await POST(makeRequest({ hash: 'abc' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Missing or invalid fields')
  })

  it('returns 400 for non-string fields', async () => {
    const res = await POST(makeRequest({ hash: 123, city: 'sj' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 for invalid hash', async () => {
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const res = await POST(makeRequest({ hash: 'bad', city: 'sj' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for soft-deleted user (regression: deleted_at filter)', async () => {
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))
    expect(res.status).toBe(403)
    expect(mockSupabase._chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns 404 when no research-tier row exists for the city', async () => {
    // First .single() = user lookup; .maybeSingle() = research city_list lookup
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })
    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'unknown' }))
    expect(res.status).toBe(404)
  })

  it('checkout queries city_lists with service_tier=research filter', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      // existing-purchase check returns null
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })
    mockStripeCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/test' })

    await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))

    // Verify the city_list query filtered on service_tier='research'
    expect(mockSupabase._chain.eq).toHaveBeenCalledWith('service_tier', 'research')
  })

  it('returns status=already_purchased when research_purchases row exists', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: { id: 99 }, error: null })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })
    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('already_purchased')
    expect(json.redirectTo).toBe(`/research/${TEST_USER.hash}/sj/status`)
  })

  it('creates Stripe session with research metadata + idempotencyKey', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })
    mockStripeCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/research_session' })

    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('checkout')
    expect(json.url).toBe('https://checkout.stripe.com/research_session')

    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: `${TEST_USER.hash}:research:${TEST_RESEARCH_CITY_LIST.id}`,
        metadata: expect.objectContaining({
          product_type: 'research',
          hash: TEST_USER.hash,
          user_id: String(TEST_USER.id),
          city_list_id: String(TEST_RESEARCH_CITY_LIST.id),
          city: 'sj',
        }),
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 199900,
              currency: 'usd',
              product_data: expect.objectContaining({
                name: TEST_RESEARCH_CITY_LIST.title,
              }),
            }),
          }),
        ]),
        success_url: expect.stringContaining(`/research/${TEST_USER.hash}/sj/status`),
        cancel_url: expect.stringContaining(`/research/${TEST_USER.hash}`),
      }),
      expect.objectContaining({
        idempotencyKey: `research:${TEST_USER.id}:${TEST_RESEARCH_CITY_LIST.id}`,
      })
    )
  })

  it('Stripe API failure surfaces as a thrown error (caller sees 500 from runtime)', async () => {
    // Per pattern of /api/create-list-checkout, Stripe throws are not caught
    // — the route handler re-throws and Next.js converts to 500. Verify by
    // asserting the handler does NOT swallow the error.
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
    mockSupabase._chain.maybeSingle.mockResolvedValueOnce({
      data: TEST_RESEARCH_CITY_LIST,
      error: null,
    })
    mockStripeCreate.mockRejectedValue(new Error('Stripe API down'))

    await expect(POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))).rejects.toThrow(
      'Stripe API down'
    )
  })
})
