/**
 * Owner contact lives only inside a lead's free-text `description`, embedded by
 * the upstream lead-publish pipeline as `Owner: Name (email, phone)`. Owner
 * contact is a PAID deliverable, so it must not survive into the pre-reveal
 * (free) description.
 *
 * `stripOwnerContact` removes that clause and, as a safety net against format
 * drift, redacts any residual email/phone. Invariant: the sanitized output
 * contains no email address and no phone number.
 *
 * Post-reveal callers show the RAW description instead (owner inline is fine —
 * they paid). This helper is only for the free view.
 */

export interface StrippedDescription {
  sanitized: string
  hasOwnerContact: boolean
}

// "Owner: Maor Greenberg (maor@spacial.io, 650-663-3339)." — the name segment
// is [^()]* so we never swallow an unrelated parenthetical like "(23PLN-00283)".
const OWNER_CLAUSE = /\s*Owner:\s*[^()]*\([^)]*\)\.?/gi
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// 10-digit US phone with optional +1 and separators. Requires 3-3-4 grouping so
// permit numbers (letters) and APNs (3-2-3, e.g. 123-45-678) don't match.
const PHONE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g

export function stripOwnerContact(
  description: string | null | undefined
): StrippedDescription {
  if (!description) return { sanitized: '', hasOwnerContact: false }

  let hasOwnerContact = false

  const removeAll = (input: string, pattern: RegExp): string => {
    const next = input.replace(pattern, '')
    if (next !== input) hasOwnerContact = true
    return next
  }

  let s = description
  s = removeAll(s, OWNER_CLAUSE)
  s = removeAll(s, EMAIL)
  s = removeAll(s, PHONE)

  // Tidy up artifacts left behind by the removals.
  s = s
    .replace(/\(\s*[,;]?\s*\)/g, '') // empty parens after inner redaction
    .replace(/\s+([.,;])/g, '$1') // space before punctuation
    .replace(/\s{2,}/g, ' ') // collapsed double spaces
    .trim()

  return { sanitized: s, hasOwnerContact }
}
