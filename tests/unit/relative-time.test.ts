import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '../../src/lib/utils'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for null input', () => {
    expect(formatRelativeTime(null)).toBe('')
  })

  it('returns "today" for today\'s date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2026-04-06')).toBe('today')
  })

  it('returns "1 day ago" for yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2026-04-05')).toBe('1 day ago')
  })

  it('returns "N days ago" for 2-29 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2026-04-01')).toBe('5 days ago')
    expect(formatRelativeTime('2026-03-08')).toBe('29 days ago')
  })

  it('returns "1 month ago" for 30 days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2026-03-07')).toBe('1 month ago')
  })

  it('returns "N months ago" for 2-11 months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2026-01-06')).toBe('3 months ago')
    expect(formatRelativeTime('2025-07-06')).toBe('9 months ago')
  })

  it('returns "1 year ago" for 12 months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2025-04-06')).toBe('1 year ago')
  })

  it('returns "N years ago" for multiple years', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z'))
    expect(formatRelativeTime('2023-04-06')).toBe('3 years ago')
  })
})
