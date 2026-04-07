import { describe, it, expect } from 'vitest'
import { maskStreetNumber } from '../../src/lib/utils'

describe('maskStreetNumber', () => {
  it('masks a simple street number', () => {
    expect(maskStreetNumber('802 COLLEEN DR')).toBe('••• COLLEEN DR')
  })

  it('masks a 4-digit street number', () => {
    expect(maskStreetNumber('1234 N Main St')).toBe('•••• N Main St')
  })

  it('masks a number with letter suffix', () => {
    expect(maskStreetNumber('123A Baker St')).toBe('•••• Baker St')
  })

  it('masks a hyphenated number (e.g. 12-34)', () => {
    expect(maskStreetNumber('12-34 Queens Blvd')).toBe('••••• Queens Blvd')
  })

  it('masks a number with slash (e.g. 1234/5)', () => {
    expect(maskStreetNumber('1234/5 Elm Ave')).toBe('•••••• Elm Ave')
  })

  it('preserves address with no leading number', () => {
    expect(maskStreetNumber('PO Box 100')).toBe('PO Box 100')
  })

  it('returns empty string unchanged', () => {
    expect(maskStreetNumber('')).toBe('')
  })

  it('preserves apartment/unit info after street name', () => {
    expect(maskStreetNumber('1234 N Main St, Apt 5')).toBe('•••• N Main St, Apt 5')
  })

  it('handles single-digit street number', () => {
    expect(maskStreetNumber('5 Oak Lane')).toBe('• Oak Lane')
  })
})
