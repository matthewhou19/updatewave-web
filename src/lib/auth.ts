import { SupabaseClient } from '@supabase/supabase-js'
import { User } from './types'

/**
 * Resolve the currently signed-in app user by matching the Supabase Auth email
 * to a row in the `users` table. Filters out soft-deleted rows.
 *
 * Returns null when:
 *   - no auth session
 *   - auth user has no email
 *   - no `users` row matches the auth email
 *   - the matching `users` row is soft-deleted
 *
 * Use this in server components / route handlers. Pair with the anon client
 * for read-only contexts (home page, browse) and the service-role client only
 * for payment-critical writes.
 */
export async function getCurrentUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser?.email) return null

  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', authUser.email)
    .is('deleted_at', null)
    .single()

  return (data as User | null) ?? null
}
