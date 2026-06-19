/**
 * Resolve the public base origin used to build absolute redirect URLs
 * (Stripe `success_url` / `cancel_url`, and any other server-built links).
 *
 * Hardened after the 2026-06-19 production outage: a non-ASCII character had
 * been baked into `NEXT_PUBLIC_BASE_URL` at build time, so every Stripe
 * checkout call 500'd with `StripeInvalidRequestError: url_invalid — "Invalid
 * URL: Non-ASCII characters in URLs must be percent-encoded"`. The checkout
 * routes interpolated that raw env value straight into `success_url`.
 *
 * This helper neutralizes a malformed env value at runtime:
 *   1. `.trim()` strips surrounding whitespace (incl. NBSP / BOM, which JS
 *      String.prototype.trim removes).
 *   2. `new URL(...).origin` validates the value and normalizes the host
 *      (IDN hosts are punycoded to ASCII). A value the URL parser rejects
 *      throws and falls through to the canonical domain.
 *   3. A final printable-ASCII guard rejects anything non-ASCII that somehow
 *      survived, falling back to the canonical domain.
 *
 * Resolution order mirrors the previous inline logic:
 *   NEXT_PUBLIC_BASE_URL  ->  https://$VERCEL_URL  ->  http://localhost:3000
 */

const CANONICAL_BASE_URL = 'https://www.updatewave.org'

export function resolveBaseUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_BASE_URL ?? '').trim()
  const fromVercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.trim()}` : ''
  const candidate = fromEnv || fromVercel || 'http://localhost:3000'

  try {
    const origin = new URL(candidate).origin
    // origin for a valid http(s) URL is always printable ASCII; anything else
    // is unsafe to hand to Stripe, so fall back to the known-good domain.
    if (/[^\x20-\x7E]/.test(origin)) return CANONICAL_BASE_URL
    return origin
  } catch {
    return CANONICAL_BASE_URL
  }
}
