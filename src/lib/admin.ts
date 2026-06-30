import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Admin gate for the /admin/* surface.
 *
 * The owner is NOT a customer, so admin identity is checked against the
 * Supabase Auth email directly (the cookie session), never the public.users
 * table.
 *
 * The allowlist DEFAULTS to the founder email (already hardcoded elsewhere in
 * the repo — see LoginForm). That means the page works through the normal
 * CI/CD deploy with NO production env var to configure. Set ADMIN_EMAILS only
 * to override/extend the list (e.g. add a second admin) without a code change.
 */

// Owner addresses, both already public in this repo (mailto: contacts in docs/), so
// listing them leaks nothing — and an email is not a credential (access still requires
// controlling the inbox). matthew.chivalri@gmail.com is the verified working login; the
// @updatewave.org address is a Cloudflare Email Routing forward kept as a brand alias.
// ADMIN_EMAILS env overrides this list entirely.
const DEFAULT_ADMIN_EMAILS = ['matthew.chivalri@gmail.com', 'matthew@updatewave.org']

/**
 * The admin allowlist. Uses ADMIN_EMAILS (comma-separated, case-insensitive)
 * when set, otherwise falls back to the founder default so prod needs no env
 * configuration. Access still requires controlling the mailbox, so listing the
 * email is not itself a credential.
 */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS
  if (!raw) return [...DEFAULT_ADMIN_EMAILS]
  const parsed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0)
  return parsed.length > 0 ? parsed : [...DEFAULT_ADMIN_EMAILS]
}

/**
 * Is this email on the admin allowlist? Case-insensitive. Fail-closed on a
 * missing email.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const allow = getAdminEmails()
  if (allow.length === 0) return false
  return allow.includes(email.trim().toLowerCase())
}

export type AdminResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }

/**
 * Resolve whether the current cookie session belongs to an allowlisted admin.
 *
 * Pass a cookie-aware client (createSupabaseServerClient). Distinguishes
 * "not logged in" (caller should redirect to /login) from "logged in but not
 * an admin" (caller should 404 to hide the page's existence).
 */
export async function resolveAdmin(supabase: SupabaseClient): Promise<AdminResult> {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser?.email) return { ok: false, reason: 'unauthenticated' }
  if (!isAdminEmail(authUser.email)) return { ok: false, reason: 'forbidden' }
  return { ok: true, email: authUser.email.trim().toLowerCase() }
}
