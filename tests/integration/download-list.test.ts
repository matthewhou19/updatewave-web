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
  pdf_storage_path: 'sj-2025.pdf',
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

const { GET } = await import('../../src/app/api/download-list/[hash]/[city]/route')

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/download-list/h/sj', {
    method: 'GET',
  })
}

function makeParams(hash: string, city: string) {
  return { params: Promise.resolve({ hash, city }) }
}

describe('GET /api/download-list/[hash]/[city]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
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

  it('returns 404 for unknown city', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'unknown'))
    expect(res.status).toBe(404)
  })

  it('returns 403 when user has not purchased', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })           // user
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })      // city list
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } }) // no purchase
    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Not purchased.')
  })

  it('returns signed URL when user has purchased', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })
      .mockResolvedValueOnce({ data: { id: 99, user_id: 1, city_list_id: 5 }, error: null })

    mockSupabase._storage.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://supabase/signed?token=abc' },
      error: null,
    })

    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toBe('https://supabase/signed?token=abc')

    // Verify Storage was called with correct bucket + path + 2-hour TTL
    expect(mockSupabase.storage.from).toHaveBeenCalledWith('city-lists-pdfs')
    expect(mockSupabase._storage.createSignedUrl).toHaveBeenCalledWith('sj-2025.pdf', 7200)
  })

  it('returns 500 when Storage signing fails', async () => {
    mockSupabase._chain.single
      .mockResolvedValueOnce({ data: TEST_USER, error: null })
      .mockResolvedValueOnce({ data: TEST_CITY_LIST, error: null })
      .mockResolvedValueOnce({ data: { id: 99 }, error: null })

    mockSupabase._storage.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: 'storage backend down' },
    })

    const res = await GET(makeRequest(), makeParams(TEST_USER.hash, 'sj'))
    expect(res.status).toBe(500)
  })
})
