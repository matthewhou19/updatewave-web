import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cookie-aware Supabase client for App Router server contexts.
 *
 * Use in:
 *   - Server Components (read-only — cookie writes throw, swallowed)
 *   - Route Handlers (read + write cookies for session refresh)
 *   - Server Actions (read + write cookies)
 *
 * Always create a new client per request. Never share across requests.
 * Pair with `supabase.auth.getUser()` to read the current session.
 *
 * For payment-critical writes that must bypass RLS, keep using
 * createSupabaseServiceClient (service-role key, no cookies).
 */
export async function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components can't set cookies during streaming.
          // Route Handlers and Server Actions don't hit this branch.
          // Token refresh writes are propagated via the next Route Handler
          // hit (e.g. /auth/callback) which can set cookies.
        }
      },
    },
  })
}
