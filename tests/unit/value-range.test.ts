import { describe, it, expect } from 'vitest'
import { matchesValueRange } from '../../src/components/ProjectList'

describe('matchesValueRange', () => {
  // "any" range matches everything
  it('returns true for "any" range with non-null cents', () => {
    expect(matchesValueRange(100_000_000, 'any')).toBe(true)
  })

  it('returns true for "any" range with null cents', () => {
    expect(matchesValueRange(null, 'any')).toBe(true)
  })

  it('returns true for "any" range with zero cents', () => {
    expect(matchesValueRange(0, 'any')).toBe(true)
  })

  // null cents — returns true for all ranges (shows no-value projects in all filters)
  it('returns true when cents is null regardless of range', () => {
    expect(matchesValueRange(null, 'under500k')).toBe(true)
    expect(matchesValueRange(null, '500k-1m')).toBe(true)
    expect(matchesValueRange(null, '1m-5m')).toBe(true)
    expect(matchesValueRange(null, 'over5m')).toBe(true)
  })

  // Under $500K: cents < 50,000,000
  describe('under500k', () => {
    it('matches value below 50M cents', () => {
      expect(matchesValueRange(25_000_000, 'under500k')).toBe(true)
    })

    it('matches zero', () => {
      expect(matchesValueRange(0, 'under500k')).toBe(true)
    })

    it('rejects value at boundary (50M cents = $500K)', () => {
      expect(matchesValueRange(50_000_000, 'under500k')).toBe(false)
    })

    it('rejects value above boundary', () => {
      expect(matchesValueRange(75_000_000, 'under500k')).toBe(false)
    })
  })

  // $500K–$1M: 50M <= cents < 100M
  describe('500k-1m', () => {
    it('matches at lower boundary (50M cents)', () => {
      expect(matchesValueRange(50_000_000, '500k-1m')).toBe(true)
    })

    it('matches mid-range', () => {
      expect(matchesValueRange(75_000_000, '500k-1m')).toBe(true)
    })

    it('rejects at upper boundary (100M cents = $1M)', () => {
      expect(matchesValueRange(100_000_000, '500k-1m')).toBe(false)
    })

    it('rejects below lower boundary', () => {
      expect(matchesValueRange(49_999_999, '500k-1m')).toBe(false)
    })
  })

  // $1M–$5M: 100M <= cents < 500M
  describe('1m-5m', () => {
    it('matches at lower boundary (100M cents)', () => {
      expect(matchesValueRange(100_000_000, '1m-5m')).toBe(true)
    })

    it('matches mid-range', () => {
      expect(matchesValueRange(250_000_000, '1m-5m')).toBe(true)
    })

    it('rejects at upper boundary (500M cents = $5M)', () => {
      expect(matchesValueRange(500_000_000, '1m-5m')).toBe(false)
    })

    it('rejects below lower boundary', () => {
      expect(matchesValueRange(99_999_999, '1m-5m')).toBe(false)
    })
  })

  // Over $5M: cents >= 500M
  describe('over5m', () => {
    it('matches at boundary (500M cents)', () => {
      expect(matchesValueRange(500_000_000, 'over5m')).toBe(true)
    })

    it('matches well above boundary', () => {
      expect(matchesValueRange(1_200_000_000, 'over5m')).toBe(true)
    })

    it('rejects just below boundary', () => {
      expect(matchesValueRange(499_999_999, 'over5m')).toBe(false)
    })
  })

  // Unknown range — defaults to true
  it('returns true for unknown range string', () => {
    expect(matchesValueRange(100_000_000, 'bogus')).toBe(true)
  })

  it('returns true for empty range string', () => {
    expect(matchesValueRange(100_000_000, '')).toBe(true)
  })
})
