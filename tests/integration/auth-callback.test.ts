import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const TEST_USER = {
  id: 7,
  hash: 'h7',
  name: null,
  company: null,
  email: 'user@example.com',
  city_filter: null,
  source_campaign: null,
  created_at: '2026-01-01T00:00:00Z',
  last_seen_at: null,
  deleted_at: null,
  auth_user_id: 'auth-uuid-7',
}

let mockVerifyOtp: ReturnType<typeof vi.fn>
let mockGetUser: ReturnType<typeof vi.fn>
let mockResolveAuthLogin: ReturnType<typeof vi.fn>
let mockLogInsert: ReturnType<typeof vi.fn>

vi.mock('@/lib/supabase-server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({
      auth: {
        verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
        getUser: () => mockGetUser(),
      },
    }),
}))

vi.mock('@/lib/supabase', () => ({
  createSupabaseServiceClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'auth_login_events') {
        return {
          insert: (...args: unknown[]) => mockLogInsert(...args),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ data: null, error: null }) }
    }),
  }),
}))

vi.mock('@/lib/auth-resolution', () => ({
  resolveAuthLogin: (...args: unknown[]) => mockResolveAuthLogin(...args),
}))

const { GET } = await import('../../src/app/auth/callback/route')

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' })
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyOtp = vi.fn()
    mockGetUser = vi.fn()
    mockResolveAuthLogin = vi.fn()
    mockLogInsert = vi.fn().mockResolvedValue({ data: null, error: null })
    process.env.NEXT_PUBLIC_BASE_URL = 'https://example.com'
  })

  it('redirects to /login with invalid_link when token_hash missing', async () => {
    const res = await GET(makeRequest('https://example.com/auth/callback'))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/login?error=invalid_link')
    expect(mockVerifyOtp).not.toHaveBeenCalled()
  })

  it('redirects to /login with link_expired when verifyOtp fails', async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'token expired' },
    })
    const res = await GET(
      makeRequest('https://example.com/auth/callback?token_hash=bad&type=magiclink')
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/login?error=link_expired')
  })

  it('redirects with session_failed when verify succeeds but no auth user', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: { user: null }, error: null })
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const res = await GET(
      makeRequest('https://example.com/auth/callback?token_hash=ok&type=magiclink')
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/login?error=session_failed')
  })

  it('on success, redirects to /browse/[hash] and logs callback_succeeded', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-uuid-7' } }, error: null })
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-uuid-7', email: 'user@example.com' } },
      error: null,
    })
    mockResolveAuthLogin.mockResolvedValueOnce({
      user: TEST_USER,
      isNew: false,
      forkAlert: null,
    })

    const res = await GET(
      makeRequest('https://example.com/auth/callback?token_hash=ok&type=magiclink')
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://example.com/browse/h7')
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 7,
        auth_user_id: 'auth-uuid-7',
        event_type: 'callback_succeeded',
      })
    )
  })

  it('on resolveAuthLogin throw, redirects with account_unavailable and logs callback_failed', async () => {
    mockVerifyOtp.mockResolvedValueOnce({ data: { user: { id: 'auth-uuid-X' } }, error: null })
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'auth-uuid-X', email: 'deleted@example.com' } },
      error: null,
    })
    mockResolveAuthLogin.mockRejectedValueOnce(new Error('insert conflict, no winner'))

    const res = await GET(
      makeRequest('https://example.com/auth/callback?token_hash=ok&type=magiclink')
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/login?error=account_unavailable')
    expect(mockLogInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        auth_user_id: 'auth-uuid-X',
        event_type: 'callback_failed',
      })
    )
  })
})
