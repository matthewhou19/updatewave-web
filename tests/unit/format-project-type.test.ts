import { describe, it, expect } from 'vitest'
import { formatProjectType } from '../../src/lib/utils'

describe('formatProjectType', () => {
  it('capitalizes a single word', () => {
    expect(formatProjectType('addition')).toBe('Addition')
  })

  it('converts snake_case to Title Case', () => {
    expect(formatProjectType('new_construction')).toBe('New Construction')
  })

  it('handles already capitalized input', () => {
    expect(formatProjectType('Remodel')).toBe('Remodel')
  })

  it('handles multiple underscores', () => {
    expect(formatProjectType('site_plan_review')).toBe('Site Plan Review')
  })
})
