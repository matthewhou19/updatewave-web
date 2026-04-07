/**
 * Shared utility functions extracted from components for testability and reuse.
 */

/**
 * Check if a project's estimated value (in cents) falls within a named range.
 * Used by the filter sidebar in ProjectList.
 */
export function matchesValueRange(cents: number | null, range: string): boolean {
  if (range === 'any' || cents === null) return true
  if (range === 'under500k') return cents < 50_000_000
  if (range === '500k-1m') return cents >= 50_000_000 && cents < 100_000_000
  if (range === '1m-5m') return cents >= 100_000_000 && cents < 500_000_000
  if (range === 'over5m') return cents >= 500_000_000
  return true
}

/**
 * Format a date string as a human-readable relative time (e.g. "3 days ago").
 * Used by ProjectCard for filing_date display.
 */
export function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  if (diffMonths < 12) return `${diffMonths} months ago`
  const diffYears = Math.floor(diffMonths / 12)
  if (diffYears === 1) return '1 year ago'
  return `${diffYears} years ago`
}
