import { describe, it, expect } from 'vitest'
import { stripOwnerContact } from '../../src/lib/owner'

/**
 * stripOwnerContact() protects the free (pre-reveal) description: owner contact
 * is a PAID deliverable, so no owner name/email/phone may survive into the
 * sanitized text. The core invariant the tests pin down:
 *   the sanitized output contains no email address and no phone number.
 */

const REAL_SAMPLE =
  'Revision to approved Individual Review (23PLN-00283): construct new pre-fab ' +
  '2-story residence with attached garage and ADU on first floor. Zoning R-1. ' +
  'Owner: Maor Greenberg (maor@spacial.io, 650-663-3339).'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/

describe('stripOwnerContact', () => {
  it('removes the "Owner: Name (contact)" clause and flags presence', () => {
    const { sanitized, hasOwnerContact } = stripOwnerContact(REAL_SAMPLE)
    expect(hasOwnerContact).toBe(true)
    expect(sanitized).not.toMatch(EMAIL)
    expect(sanitized).not.toMatch(PHONE)
    expect(sanitized).not.toContain('Maor Greenberg')
    expect(sanitized).not.toContain('Owner:')
  })

  it('keeps the project scope prose intact', () => {
    const { sanitized } = stripOwnerContact(REAL_SAMPLE)
    expect(sanitized).toContain('construct new pre-fab 2-story residence')
    // The non-owner parenthetical (permit number) must NOT be clobbered.
    expect(sanitized).toContain('(23PLN-00283)')
    expect(sanitized).toContain('Zoning R-1')
    // No dangling whitespace or double spaces left behind.
    expect(sanitized).toBe(sanitized.trim())
    expect(sanitized).not.toMatch(/\s{2,}/)
  })

  it('returns hasOwnerContact=false and unchanged prose when there is no owner', () => {
    const plain = 'Construct a new single-family residence. Zoning R-1.'
    const { sanitized, hasOwnerContact } = stripOwnerContact(plain)
    expect(hasOwnerContact).toBe(false)
    expect(sanitized).toBe(plain)
  })

  it('handles null / empty description', () => {
    expect(stripOwnerContact(null)).toEqual({ sanitized: '', hasOwnerContact: false })
    expect(stripOwnerContact('')).toEqual({ sanitized: '', hasOwnerContact: false })
  })

  it('safety net: redacts a bare email even without the "Owner:" label', () => {
    const drift = 'New ADU. Contact jane@builder.io for questions.'
    const { sanitized, hasOwnerContact } = stripOwnerContact(drift)
    expect(hasOwnerContact).toBe(true)
    expect(sanitized).not.toMatch(EMAIL)
  })

  it('safety net: redacts a bare phone number even without the "Owner:" label', () => {
    const drift = 'New ADU. Call 650-663-3339.'
    const { sanitized, hasOwnerContact } = stripOwnerContact(drift)
    expect(hasOwnerContact).toBe(true)
    expect(sanitized).not.toMatch(PHONE)
  })

  it('does not treat a permit/APN-style number as a phone', () => {
    const withPermit = 'Addition per permit 23PLN-00283. APN 123-45-678.'
    const { sanitized, hasOwnerContact } = stripOwnerContact(withPermit)
    expect(hasOwnerContact).toBe(false)
    expect(sanitized).toContain('23PLN-00283')
    expect(sanitized).toContain('123-45-678')
  })
})
