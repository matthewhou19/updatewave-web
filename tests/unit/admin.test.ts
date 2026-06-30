import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminEmails, isAdminEmail, resolveAdmin } from '@/lib/admin'

afterEach(() => {
  vi.unstubAllEnvs()
})

function mockAuth(authUser: { id: string; email?: string } | null): SupabaseClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: authUser }, error: null }),
    },
  } as unknown as SupabaseClient
}

describe('getAdminEmails', () => {
  it('defaults to the founder email when unset/empty (no prod env needed)', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(getAdminEmails()).toEqual(['matthew@updatewave.org'])
  })

  it('splits, trims, lowercases, and drops empties when ADMIN_EMAILS overrides', () => {
    vi.stubEnv('ADMIN_EMAILS', ' A@x.com , b@Y.com ,, ')
    expect(getAdminEmails()).toEqual(['a@x.com', 'b@y.com'])
  })
})

describe('isAdminEmail', () => {
  it('falls back to the founder default when ADMIN_EMAILS is unset', () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(isAdminEmail('matthew@updatewave.org')).toBe(true)
    expect(isAdminEmail('a@x.com')).toBe(false)
  })

  it('false for null/undefined email', () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@x.com')
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
  })

  it('matches case-insensitively', () => {
    vi.stubEnv('ADMIN_EMAILS', 'matthew@updatewave.org')
    expect(isAdminEmail('Matthew@UpdateWave.org')).toBe(true)
  })

  it('false for a non-listed email', () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@x.com')
    expect(isAdminEmail('intruder@evil.com')).toBe(false)
  })
})

describe('resolveAdmin', () => {
  it('unauthenticated when there is no session', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@x.com')
    const res = await resolveAdmin(mockAuth(null))
    expect(res).toEqual({ ok: false, reason: 'unauthenticated' })
  })

  it('unauthenticated when the session has no email', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@x.com')
    const res = await resolveAdmin(mockAuth({ id: 'uuid' }))
    expect(res).toEqual({ ok: false, reason: 'unauthenticated' })
  })

  it('forbidden when logged in but not allowlisted', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'a@x.com')
    const res = await resolveAdmin(mockAuth({ id: 'uuid', email: 'intruder@evil.com' }))
    expect(res).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('ok with a normalized email when allowlisted', async () => {
    vi.stubEnv('ADMIN_EMAILS', 'matthew@updatewave.org')
    const res = await resolveAdmin(mockAuth({ id: 'uuid', email: 'Matthew@UpdateWave.org' }))
    expect(res).toEqual({ ok: true, email: 'matthew@updatewave.org' })
  })
})
