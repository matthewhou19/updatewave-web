import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock data
const TEST_USER = { id: 1, hash: 'test_hash_123' }
const TEST_PROJECT_ID = 42

// Build mock chains for Supabase (chainable .from().select().eq().is().single() pattern)
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
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

function makeCheckoutEvent(
  clientRefId: string | null,
  metadata: Record<string, string> | null = null,
  amountTotal = 2500,
  paymentStatus: string = 'paid'
) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        client_reference_id: clientRefId,
        amount_total: amountTotal,
        payment_intent: 'pi_test_123',
        payment_status: paymentStatus,
        metadata: metadata ?? {},
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

  // ─────────────────────────────────────────────────────────────────────────
  // Soft-delete regression (migration 001 added users.deleted_at; this PR
  // makes the webhook honor it).
  // ─────────────────────────────────────────────────────────────────────────

  it('does NOT insert reveal when user is soft-deleted (deleted_at IS NOT NULL)', async () => {
    // Stripe gives us a session with a valid hash; resolveUserByHash applies
    // .is('deleted_at', null), and if the user has been deleted that filter
    // returns null. The webhook must 200 OK without inserting.
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`)
    )
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // List flow (new product_type='list' branch)
  // ─────────────────────────────────────────────────────────────────────────

  const LIST_METADATA = {
    product_type: 'list',
    hash: TEST_USER.hash,
    user_id: String(TEST_USER.id),
    city_list_id: '1',
    city: 'sj',
  }

  const TEST_CITY_LIST = {
    id: 1,
    city: 'sj',
    year: 2025,
    title: 'San Jose 2025',
    description: 'desc',
    price_cents: 34900,
    active: true,
    created_at: '2026-04-28T00:00:00Z',
    updated_at: '2026-04-28T00:00:00Z',
  }

  it('inserts list_purchases row on valid list checkout event', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, LIST_METADATA, 34900)
    )
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })       // resolveUserByHash
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })  // fetchCityList
    mockSupabase._chain.insert.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)

    expect(mockSupabase.from).toHaveBeenCalledWith('list_purchases')
    expect(mockSupabase._chain.insert).toHaveBeenCalledWith({
      user_id: TEST_USER.id,
      city_list_id: 1,
      stripe_session_id: 'cs_test_123',
      stripe_payment_id: 'pi_test_123',
      amount_cents: 34900,
    })
  })

  it('list flow: returns 200 without insert when metadata is missing', async () => {
    // Defensive: a stripe event tagged product_type='list' but missing hash /
    // user_id / city_list_id should 200 (don't make Stripe retry) and not insert.
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, { product_type: 'list' })
    )

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('list flow: handles duplicate (UNIQUE 23505) idempotently', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, LIST_METADATA, 34900)
    )
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })
    mockSupabase._chain.insert.mockResolvedValueOnce({
      error: { code: '23505', message: 'duplicate key value' },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.received).toBe(true)
  })

  it('list flow: deleted user does NOT receive list_purchases row', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, LIST_METADATA, 34900)
    )
    // resolveUserByHash returns null because deleted_at filter excludes the row
    mockSupabase._chain.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.is).toHaveBeenCalledWith('deleted_at', null)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('list flow: user_id mismatch (metadata stale) does NOT insert', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, { ...LIST_METADATA, user_id: '999' })
    )
    // resolveUserByHash returns the actual user (id=1), metadata says 999 → reject
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('list flow: returns 500 on non-duplicate DB error', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, LIST_METADATA, 34900)
    )
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })
    mockSupabase._chain.insert.mockResolvedValueOnce({
      error: { code: '42P01', message: 'relation does not exist' },
    })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(500)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Payment safety guards (post-review hardening)
  // ─────────────────────────────────────────────────────────────────────────

  it('does NOT insert when payment_status is unpaid (async pending)', async () => {
    // Stripe checkout.session.completed fires for async payment methods (Cash App,
    // ACH) BEFORE the payment is actually captured. We must wait for paid status.
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`, null, 2500, 'unpaid')
    )

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('does NOT insert reveal when amount_total != $25 (catches $0 coupon)', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`, null, 0)
    )
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('does NOT insert list when amount_total != city_lists.price_cents', async () => {
    // Mismatched amount: metadata says SJ list ($349), but Stripe reports $50.
    // Webhook must reject without insert.
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, LIST_METADATA, 5000)  // $50 instead of $349
    )
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })  // expects $349

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('list flow: missing metadata.city does NOT insert', async () => {
    const metadataNoCity = { ...LIST_METADATA }
    delete (metadataNoCity as Record<string, string>).city
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, metadataNoCity, 34900)
    )
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  it('list flow: city_list_id mismatch with looked-up city does NOT insert', async () => {
    // Metadata says city_list_id=1 but the city_lists row for 'sj' is id=99
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(null, LIST_METADATA, 34900)
    )
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: { ...TEST_CITY_LIST, id: 99 }, error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase._chain.insert).not.toHaveBeenCalled()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Dispatch correctness
  // ─────────────────────────────────────────────────────────────────────────

  it('dispatches to reveal flow when metadata.product_type is missing (legacy compat)', async () => {
    // No metadata at all → defaults to reveal. This protects existing reveal
    // sessions that were created before the metadata routing change.
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`)
    )
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })
    mockSupabase._chain.insert.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase.from).toHaveBeenCalledWith('reveals')
  })

  it('dispatches to reveal flow when metadata.product_type="reveal"', async () => {
    mockStripeConstructEvent.mockReturnValue(
      makeCheckoutEvent(`${TEST_USER.hash}:${TEST_PROJECT_ID}`, { product_type: 'reveal' })
    )
    mockSupabase._chain.single.mockResolvedValueOnce({ data: TEST_USER, error: null })
    mockSupabase._chain.insert.mockResolvedValueOnce({ error: null })

    const res = await POST(makeRequest('{}'))
    expect(res.status).toBe(200)
    expect(mockSupabase.from).toHaveBeenCalledWith('reveals')
  })
})
