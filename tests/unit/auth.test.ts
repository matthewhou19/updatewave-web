import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'

function mockSupabase(authUser: { email: string } | null, dbUser: unknown) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: null,
      }),
    },
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: dbUser, error: null }),
  } as unknown as SupabaseClient
}

describe('getCurrentUser', () => {
  it('returns null when no auth session', async () => {
    const supabase = mockSupabase(null, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })

  it('returns null when auth user has no email', async () => {
    const supabase = mockSupabase({ email: '' }, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })

  it('returns user row when auth.email matches users.email', async () => {
    const dbUser = { id: 42, hash: 'abc', email: 'matt@example.com', deleted_at: null }
    const supabase = mockSupabase({ email: 'matt@example.com' }, dbUser)
    const user = await getCurrentUser(supabase)
    expect(user?.id).toBe(42)
  })

  it('returns null when auth user not in users table', async () => {
    const supabase = mockSupabase({ email: 'stranger@example.com' }, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })
})
