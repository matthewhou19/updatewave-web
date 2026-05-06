/**
 * Validate a `next` query parameter so /login + /auth/callback can redirect
 * the freshly-authenticated user to a tier-specific page (e.g. /list/{hash}/sj
 * after they came in via a /pricing CTA) without opening a redirect-to-attacker
 * vulnerability.
 *
 * Allowed: internal absolute paths (start with `/`), no protocol-relative
 * `//` (which would hit a foreign origin), no scheme `:` (which `new URL()`
 * would treat as absolute). The optional `{hash}` placeholder is preserved
 * literally; callers substitute it after identity resolution via
 * `applyHashToNext`.
 */
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (typeof raw !== 'string') return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.includes(':')) return null
  return raw
}

/**
 * Substitute the `{hash}` placeholder in a sanitized `next` path with the
 * resolved user.hash. Returns the path unchanged if no placeholder is
 * present (e.g. for `/account` or other hash-free destinations).
 */
export function applyHashToNext(next: string, hash: string): string {
  return next.replace('{hash}', hash)
}
