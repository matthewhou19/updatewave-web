import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_USER = { id: 1, hash: 'test_hash_123' }
const TEST_PROJECT = { id: 42, address: '123 Main St', status: 'published' }

function createMockSupabase() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn(),
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

const { POST } = await import('../../src/app/api/create-checkout/route')

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/create-checkout', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/create-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    mockStripeCreate = vi.fn()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost:3000/api/create-checkout', {
      method: 'POST',
      body: 'not json',
      headers: { 'content-type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for missing fields', async () => {
    const res = await POST(makeRequest({ hash: 'abc' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Missing or invalid fields')
  })

  it('returns 400 when projectId is not a number', async () => {
    const res = await POST(makeRequest({ hash: 'abc', projectId: 'not-a-number' }))
    expect(res.status).toBe(400)
  })

  it('returns 403 for invalid hash', async () => {
    // First .single() call = user lookup fails
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })
    const res = await POST(makeRequest({ hash: 'bad_hash', projectId: 42 }))
    expect(res.status).toBe(403)
  })

  it('returns 404 for non-existent project', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })  // user found
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })  // project not found
    const res = await POST(makeRequest({ hash: TEST_USER.hash, projectId: 999 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 for unpublished project', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: { ...TEST_PROJECT, status: 'stale' }, error: null })
    const res = await POST(makeRequest({ hash: TEST_USER.hash, projectId: TEST_PROJECT.id }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('no longer available')
  })

  it('returns 200 "Already revealed" for existing reveal', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })     // user
      .mockResolvedValueOnce({ data: TEST_PROJECT, error: null })  // project
      .mockResolvedValueOnce({ data: { id: 1 }, error: null })     // existing reveal
    const res = await POST(makeRequest({ hash: TEST_USER.hash, projectId: TEST_PROJECT.id }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.message).toBe('Already revealed.')
  })

  it('creates Stripe checkout session and returns URL', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })     // user
      .mockResolvedValueOnce({ data: TEST_PROJECT, error: null })  // project
      .mockResolvedValueOnce({ data: null, error: { message: 'not found' } })  // no existing reveal
    mockStripeCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/session_123' })

    const res = await POST(makeRequest({ hash: TEST_USER.hash, projectId: TEST_PROJECT.id }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://checkout.stripe.com/session_123')

    // Verify Stripe session parameters
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        client_reference_id: `${TEST_USER.hash}:${TEST_PROJECT.id}`,
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 2500,
              currency: 'usd',
            }),
          }),
        ]),
      })
    )
  })
})
