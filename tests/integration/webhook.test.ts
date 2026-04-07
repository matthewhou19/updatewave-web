import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock data
const TEST_USER = { id: 1, hash: 'test_hash_123' }
const TEST_PROJECT_ID = 42

// Build mock chains for Supabase (chainable .from().select().eq().single() pattern)
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn().mockReturnThis(),
  }
  return {
    from: vi.fn(() => ({ ...mockChain, ...overrides })),
    _chain: mockChain,
  }
}

let mockSupabase: ReturnType<typeof createMockSupabase>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mockStripeConstructEvent: any

vi.mock('@/lib/supabase', () => ({
  createSupabaseServiceClient: () => mockSupabase,
}))

vi.mock('@/lib/stripe', () => ({
  createStripeClient: () => ({
    webhooks: {
      constructEvent: (...args: unknown[]) => mockStripeConstructEvent(...args),
    },
  }),
}))

// Import after mocks are set up
const { POST } = await import('../../src/app/api/webhook/route')

function makeRequest(body: string, signature = 'valid_sig'): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhook', {
    method: 'POST',
    body,
    headers: {
      'stripe-signature': signature,
      'content-type': 'application/json',
    },
  })
}

function makeCheckoutEvent(clientRefId: string | null) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        client_reference_id: clientRefId,
        amount_total: 2500,
        payment_intent: 'pi_test_123',
      },
    },
  }
}

describe('POST /api/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    mockStripeConstructEvent = vi.fn()
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
  })

  it('returns 500 if STRIPE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(500)
  })

  it('returns 400 if stripe-signature header is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/webhook', {
      method: 'POST',
      body: '{}',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 if signature verification fails', async () => {
    mockStripeConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature')
    })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toContain('Webhook signature verification failed')
  })

  it('returns 200 for non-checkout events', async () => {
    mockStripeConstructEvent.mockReturnValue({ type: 'invoice.paid' })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })

  it('returns 200 when client_reference_id is missing', async () => {
    mockStripeConstructEvent.mockReturnValue(makeCheckoutEvent(null))
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
  })

  it('returns 200 when client_reference_id has no colon', async () => {
    mockStripeConstructEvent.mockReturnValue(makeCheckoutEvent('no-colon-here'))
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
  })

  it('returns 200 when user is not found (idempotent)', async () => {
    mockStripeConstructEvent.mockReturnValue(makeCheckoutEvent('hash:42'))
    mockSupabase._chain.single.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
  })

  it('inserts reveal on valid checkout event', async () => {
    mockStripeConstructEvent.mockReturnValue(makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`))

    // First .single() call = user lookup
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })

    // Insert call = reveal insertion
    mockSupabase._chain.insert.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    // Verify insert was called with correct data
    expect(mockSupabase.from).toHaveBeenCalledWith('reveals')
    expect(mockSupabase._chain.insert).toHaveBeenCalledWith({
      user_id: TEST_USER.id,
      project_id: TEST_PROJECT_ID,
      stripe_payment_id: 'pi_test_123',
      amount_cents: 2500,
    })
  })

  it('handles duplicate reveal gracefully (UNIQUE constraint 23505)', async () => {
    mockStripeConstructEvent.mockReturnValue(makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`))
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })
    mockSupabase._chain.insert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })

  it('returns 500 on non-duplicate insert error', async () => {
    mockStripeConstructEvent.mockReturnValue(makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`))
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })
    mockSupabase._chain.insert.mockResolvedValueOnce({
      error: { code: '42P01', message: 'relation does not exist' },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(500)
  })
})
