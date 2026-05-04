import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_USER = { id: 1, hash: 'test_hash_123' }
const TEST_CITY_LIST = {
  id: 5,
  city: 'sj',
  year: 2025,
  title: 'San Jose 2025 GC Market Structure Report',
  description: 'desc',
  price_cents: 34900,
  active: true,
  created_at: '2026-04-28T00:00:00Z',
  updated_at: '2026-04-28T00:00:00Z',
}

function createMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn(),
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
}))

const { POST } = await import('../../src/app/api/create-list-checkout/route')

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/create-list-checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/create-list-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    mockStripeCreate = vi.fn()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-list-checkout', {
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

  it('returns 403 for invalid hash', async () => {
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const res = await POST(makeRequest({ hash: 'bad', city: 'sj' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for soft-deleted user (regression: deleted_at filter)', async () => {
    // resolveUserByHash applies .is('deleted_at', null) → deleted user is null.
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))
    expect(res.status).toBe(403)
    expect(mockSupabase._chain.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('returns 404 for unknown city', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'unknown' }))
    expect(res.status).toBe(404)
  })

  it('returns status=already_purchased with redirectTo when purchase exists', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })           // user
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })      // city list
      .mockResolvedValueOnce({ data: { id: 99 }, error: null })          // existing purchase
    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('already_purchased')
    expect(json.redirectTo).toBe(`/list/${TEST_USER.hash}/sj/success`)
  })

  it('creates Stripe session with metadata + idempotencyKey and returns status=checkout', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // no existing purchase
    mockStripeCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/sj_session' })

    const res = await POST(makeRequest({ hash: TEST_USER.hash, city: 'sj' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('checkout')
    expect(json.url).toBe('https://checkout.stripe.com/sj_session')

    // First arg: session params (full shape check)
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: `${TEST_USER.hash}:list:${TEST_CITY_LIST.id}`,
        metadata: expect.objectContaining({
          product_type: 'list',
          hash: TEST_USER.hash,
          user_id: String(TEST_USER.id),
          city_list_id: String(TEST_CITY_LIST.id),
          city: 'sj',
        }),
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: TEST_CITY_LIST.price_cents,
              currency: 'usd',
              product_data: expect.objectContaining({
                name: TEST_CITY_LIST.title,
              }),
            }),
          }),
        ]),
        success_url: expect.stringContaining(`/list/${TEST_USER.hash}/sj/success`),
        cancel_url: expect.stringContaining(`/list/${TEST_USER.hash}/sj`),
      }),
      expect.objectContaining({
        idempotencyKey: `list:${TEST_USER.id}:${TEST_CITY_LIST.id}`,
      })
    )
  })
})
