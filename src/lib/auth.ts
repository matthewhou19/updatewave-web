import { SupabaseClient } from '@supabase/supabase-js'
import { User } from './types'

/**
 * Resolve the currently signed-in app user.
 *
 * Joins `auth.users.id` (from the cookie session) → `public.users.auth_user_id`.
 * `auth_user_id` is the canonical link established by /auth/callback's
 * 4-case identity resolution; once set, it is the stable join key even if
 * the user later changes their email.
 *
 * Returns null when:
 *   - no auth session
 *   - the cookie session is valid but `users.auth_user_id` doesn't match
 *     (user hit a stale session before /auth/callback finished, or their
 *     row was soft-deleted)
 *
 * Use in server components / route handlers via the cookie-aware Supabase
 * client (`createSupabaseServerClient`). For payment-critical writes that
 * must bypass RLS, keep using `createSupabaseServiceClient`.
 */
export async function getCurrentUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser?.id) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .is('deleted_at', null)
    .maybeSingle()

  return (data as User | null) ?? null
}
