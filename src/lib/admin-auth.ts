import { cookies } from 'next/headers'

/**
 * Password gate for the /admin surface.
 *
 * The owner is the only admin, so this is a single shared password set via the
 * ADMIN_PASSWORD env var (a Cloudflare Worker secret in prod). It is entirely
 * independent of the customer Supabase magic-link auth — no email, no inbox.
 *
 * On login we set an httpOnly cookie whose value is sha256("uw-admin:" + password):
 * a bearer token that proves knowledge of the password without storing the
 * password itself. The leads page and its Server Actions verify it per request.
 */

const COOKIE_NAME = 'uw_admin'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function getAdminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD
  return p && p.length > 0 ? p : null
}

/** Constant-time string comparison (don't leak match length via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Does the submitted password match ADMIN_PASSWORD? Fail-closed if unset. */
export function checkAdminPassword(input: string): boolean {
  const pw = getAdminPassword()
  if (!pw) return false
  return timingSafeEqual(input, pw)
}

async function sessionToken(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(`uw-admin:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Set the admin session cookie after a verified password. */
export async function setAdminSession(): Promise<void> {
  const pw = getAdminPassword()
  if (!pw) return
  const token = await sessionToken(pw)
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Secure only in prod so the cookie still sets over http://localhost in dev.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

/** Is the current request an authenticated admin? */
export async function isAdminAuthed(): Promise<boolean> {
  const pw = getAdminPassword()
  if (!pw) return false
  const store = await cookies()
  const value = store.get(COOKIE_NAME)?.value
  if (!value) return false
  const expected = await sessionToken(pw)
  return timingSafeEqual(value, expected)
}

/** Clear the admin session (logout). */
export async function clearAdminSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
