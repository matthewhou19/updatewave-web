import { describe, it, expect } from 'vitest'
import { sanitizeNext, applyHashToNext } from '@/lib/safe-next'

describe('sanitizeNext', () => {
  it('returns null for null/undefined/empty', () => {
    expect(sanitizeNext(null)).toBeNull()
    expect(sanitizeNext(undefined)).toBeNull()
    expect(sanitizeNext('')).toBeNull()
  })

  it('accepts an internal absolute path', () => {
    expect(sanitizeNext('/browse/{hash}')).toBe('/browse/{hash}')
    expect(sanitizeNext('/list/{hash}/sj')).toBe('/list/{hash}/sj')
    expect(sanitizeNext('/pricing')).toBe('/pricing')
  })

  it('rejects protocol-relative paths (open-redirect to foreign origin)', () => {
    expect(sanitizeNext('//evil.example.com/phish')).toBeNull()
    expect(sanitizeNext('//attacker.com')).toBeNull()
  })

  it('rejects absolute URLs with a scheme', () => {
    expect(sanitizeNext('https://evil.example.com')).toBeNull()
    expect(sanitizeNext('http://attacker.com/x')).toBeNull()
    expect(sanitizeNext('javascript:alert(1)')).toBeNull()
    expect(sanitizeNext('data:text/html,<script>')).toBeNull()
  })

  it('rejects relative paths (no leading slash)', () => {
    expect(sanitizeNext('browse/h7')).toBeNull()
    expect(sanitizeNext('../etc/passwd')).toBeNull()
  })

  it('rejects any path containing a colon (defense in depth)', () => {
    // A colon could come from an attacker-supplied scheme that snuck past
    // the leading-slash check. Reject defensively.
    expect(sanitizeNext('/some:path')).toBeNull()
  })
})

describe('applyHashToNext', () => {
  it('replaces the {hash} token with the user hash', () => {
    expect(applyHashToNext('/browse/{hash}', 'abc')).toBe('/browse/abc')
    expect(applyHashToNext('/list/{hash}/sj', 'h7')).toBe('/list/h7/sj')
    expect(applyHashToNext('/research/{hash}', 'xyz')).toBe('/research/xyz')
  })

  it('leaves paths without a {hash} placeholder unchanged', () => {
    expect(applyHashToNext('/pricing', 'abc')).toBe('/pricing')
    expect(applyHashToNext('/account', 'abc')).toBe('/account')
  })

  it('replaces only the first occurrence (current contract)', () => {
    // String.replace without /g only replaces the first match. The pricing
    // tier templates each contain at most one {hash}, so this is fine; we
    // assert it explicitly so a future change to the contract is intentional.
    expect(applyHashToNext('/x/{hash}/y/{hash}', 'h')).toBe('/x/h/y/{hash}')
  })
})
