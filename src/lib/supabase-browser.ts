'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client for client components.
 *
 * Used by /login to call `signInWithOtp`. After /auth/callback completes,
 * server components should resolve the session via createSupabaseServerClient
 * + getCurrentUser instead.
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!supabaseAnonKey) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
