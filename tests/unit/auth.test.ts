import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth'

function mockSupabase(
  authUser: { id: string; email?: string } | null,
  dbUser: unknown
) {
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
    maybeSingle: vi.fn().mockResolvedValue({ data: dbUser, error: null }),
  } as unknown as SupabaseClient
}

describe('getCurrentUser', () => {
  it('returns null when no auth session', async () => {
    const supabase = mockSupabase(null, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })

  it('returns user row when auth.id matches users.auth_user_id', async () => {
    const authUserId = '00000000-0000-0000-0000-000000000001'
    const dbUser = {
      id: 42,
      hash: 'abc',
      email: 'matt@example.com',
      auth_user_id: authUserId,
      deleted_at: null,
    }
    const supabase = mockSupabase({ id: authUserId, email: 'matt@example.com' }, dbUser)
    const user = await getCurrentUser(supabase)
    expect(user?.id).toBe(42)
    // Verify it joined on auth_user_id, not email
    expect(supabase.from).toHaveBeenCalledWith('users')
    expect(
      (supabase as unknown as { eq: ReturnType<typeof vi.fn> }).eq
    ).toHaveBeenCalledWith('auth_user_id', authUserId)
  })

  it('returns null when auth_user_id has no users row', async () => {
    const supabase = mockSupabase({ id: 'orphan-uuid' }, null)
    const user = await getCurrentUser(supabase)
    expect(user).toBeNull()
  })

  it('applies deleted_at IS NULL filter (regression: soft-deleted users blocked)', async () => {
    const supabase = mockSupabase({ id: 'uuid' }, null)
    await getCurrentUser(supabase)
    expect(
      (supabase as unknown as { is: ReturnType<typeof vi.fn> }).is
    ).toHaveBeenCalledWith('deleted_at', null)
  })
})
