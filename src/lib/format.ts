/**
 * Shared formatting helpers used across pages.
 *
 * Keep this file small and dependency-free. Anything Date-locale-sensitive
 * or i18n-related lives here so all callers render dates/prices consistently.
 */

/**
 * Format a USD price from a cents value, e.g. 34900 -> "$349".
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
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
