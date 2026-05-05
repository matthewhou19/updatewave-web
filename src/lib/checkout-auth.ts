import { SupabaseClient } from '@supabase/supabase-js'
import { resolveUserByHash } from './queries'
import { createSupabaseServerClient } from './supabase-server'
import { getCurrentUser } from './auth'

export interface CheckoutUser {
  id: number
  hash: string
}

export type CheckoutAuthResult =
  | { user: CheckoutUser; hash: string }
  | { errorResponse: Response }

/**
 * Resolve the user identity for a checkout request via either:
 *   - Hash from request body (cold-email funnel — existing path, takes precedence).
 *   - Cookie session (logged-in user — new path).
 *
 * Returns either { user, hash } or { errorResponse } encoding the appropriate
 * status (403 for invalid hash, 401 for no session). Both checkout endpoints
 * share this so the precedence rule and the 401-vs-403 policy live in one place.
 */
export async function resolveCheckoutUser(
  supabase: SupabaseClient,
  requestedHash: string | null
): Promise<CheckoutAuthResult> {
  if (requestedHash) {
    const result = await resolveUserByHash(supabase, requestedHash)
    if (result.error || !result.user) {
      return {
        errorResponse: Response.json({ error: 'Invalid link.' }, { status: 403 }),
      }
    }
    return { user: result.user, hash: requestedHash }
  }

  const cookieClient = await createSupabaseServerClient()
  const sessionUser = await getCurrentUser(cookieClient)
  if (!sessionUser) {
    return {
      errorResponse: Response.json({ error: 'Not signed in.' }, { status: 401 }),
    }
  }
  return {
    user: { id: sessionUser.id, hash: sessionUser.hash },
    hash: sessionUser.hash,
  }
}
