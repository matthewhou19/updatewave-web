/**
 * Shared formatting helpers used across pages.
 *
 * Keep this file small and dependency-free. Anything Date-locale-sensitive
 * or i18n-related lives here so all callers render dates/prices consistently.
 */

/**
 * Format a USD price from a cents value, e.g. 49900 -> "$499".
 * No decimals for whole-dollar amounts. Returns "—" for null/undefined.
 */
export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

/**
 * Format an ISO date string, e.g. "2026-04-28T..." -> "Apr 28, 2026".
 * Returns "—" for null/undefined or empty input.
 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  // Date-only strings (YYYY-MM-DD, e.g. filing_date) must be parsed as LOCAL,
  // not UTC, or they render one day early in negative-offset timezones. Full
  // timestamps carry their own offset and are left as-is.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(`${iso}T00:00:00`)
    : new Date(iso)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
