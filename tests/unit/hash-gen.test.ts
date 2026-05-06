import { describe, it, expect } from 'vitest'
import { generateUserHash } from '@/lib/hash-gen'

describe('generateUserHash', () => {
  it('returns a 32-char lowercase hex string', () => {
    const hash = generateUserHash()
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('produces unique values across calls', () => {
    const hashes = new Set<string>()
    for (let i = 0; i < 1000; i += 1) {
      hashes.add(generateUserHash())
    }
    expect(hashes.size).toBe(1000)
  })

  it('does not contain URL-unsafe characters', () => {
    const hash = generateUserHash()
    expect(encodeURIComponent(hash)).toBe(hash)
  })
})
