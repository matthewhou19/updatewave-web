import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { resolveAuthLogin } from '@/lib/auth-resolution'

/**
 * Magic-link callback. Hit by the user clicking the link in their email.
 *
 * Flow:
 *   1. Read `token_hash` + `type` from query string.
 *   2. Verify with Supabase Auth (sets the cookie session).
 *   3. Resolve `auth.users.id` → `public.users` row via 4-case identity logic.
 *   4. Track outcome via `auth_login_events` (best-effort).
 *   5. Redirect to /browse/[hash] on success or /login with error otherwise.
 *
 * The cookie client handles the session writes; the service-role client
 * handles RLS-bypassing writes for identity resolution and event logging.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') ?? 'magiclink'
  const origin = baseUrl(request)

  if (!tokenHash) {
    return NextResponse.redirect(
      `${origin}/login?error=invalid_link`,
      { status: 303 }
    )
  }

  const cookieClient = await createSupabaseServerClient()

  const { error: verifyError } = await cookieClient.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'magiclink' | 'email' | 'recovery' | 'invite',
  })

  if (verifyError) {
    return NextResponse.redirect(
      `${origin}/login?error=link_expired`,
      { status: 303 }
    )
  }

  const {
    data: { user: authUser },
  } = await cookieClient.auth.getUser()

  if (!authUser?.id || !authUser.email) {
    return NextResponse.redirect(
      `${origin}/login?error=session_failed`,
      { status: 303 }
    )
  }

  const service = createSupabaseServiceClient()

  try {
    const result = await resolveAuthLogin(service, authUser.id, authUser.email)

    await logEvent(service, 'callback_succeeded', result.user.id, authUser.id)

    return NextResponse.redirect(
      `${origin}/browse/${result.user.hash}`,
      { status: 303 }
    )
  } catch (err) {
    await logEvent(service, 'callback_failed', null, authUser.id)
    // Soft-deleted account or other resolution failure surfaces as a
    // generic "account not available" message on /login.
    console.warn('[auth/callback] resolution failed', {
      authUserId: authUser.id,
      message: err instanceof Error ? err.message : 'unknown',
    })
    return NextResponse.redirect(
      `${origin}/login?error=account_unavailable`,
      { status: 303 }
    )
  }
}

function baseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return new URL(request.url).origin
}

async function logEvent(
  service: ReturnType<typeof createSupabaseServiceClient>,
  eventType: 'callback_succeeded' | 'callback_failed',
  userId: number | null,
  authUserId: string
): Promise<void> {
  try {
    await service.from('auth_login_events').insert({
      user_id: userId,
      auth_user_id: authUserId,
      event_type: eventType,
    })
  } catch {
    // Telemetry is best-effort. Don't block the user on a logging failure.
  }
}
