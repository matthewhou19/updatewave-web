import { describe, it, expect } from 'vitest'
import type { Project } from '@/lib/types'
import { sortLeadItems, pickSort, type LeadItem } from '@/app/admin/leads/leads-sort'

function project(overrides: Partial<Project>): Project {
  return {
    id: 1,
    city: 'San Jose',
    address: 'A St',
    project_type: 'new_construction',
    estimated_value_cents: null,
    estimated_value: null,
    architect_name: null,
    architect_firm: null,
    architect_contact: null,
    architect_website: null,
    description: null,
    source_permit_id: null,
    filing_date: null,
    last_action_date: null,
    last_action_summary: null,
    source_url: null,
    status: 'candidate',
    reveal_count: 0,
    reviewed_at: null,
    published_at: null,
    updated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function item(overrides: Partial<Project>): LeadItem {
  return { project: project(overrides), drawings: [] }
}

describe('sortLeadItems', () => {
  it('does not mutate the input array', () => {
    const items = [item({ id: 1, address: 'B' }), item({ id: 2, address: 'A' })]
    const before = items.map((i) => i.project.id)
    sortLeadItems(items, 'address', 'asc', 'created_at')
    expect(items.map((i) => i.project.id)).toEqual(before)
  })

  it('sorts by address A→Z (asc) and Z→A (desc)', () => {
    const items = [item({ id: 1, address: 'Coe Ave' }), item({ id: 2, address: 'Alma St' })]
    expect(sortLeadItems(items, 'address', 'asc', 'created_at').map((i) => i.project.id)).toEqual([2, 1])
    expect(sortLeadItems(items, 'address', 'desc', 'created_at').map((i) => i.project.id)).toEqual([1, 2])
  })

  it('sorts by date desc = newest first, using the given dateField', () => {
    const items = [
      item({ id: 1, created_at: '2026-01-01T00:00:00Z', published_at: '2026-06-01T00:00:00Z' }),
      item({ id: 2, created_at: '2026-03-01T00:00:00Z', published_at: '2026-02-01T00:00:00Z' }),
    ]
    // by created_at: id2 (Mar) is newest
    expect(sortLeadItems(items, 'date', 'desc', 'created_at').map((i) => i.project.id)).toEqual([2, 1])
    // by published_at: id1 (Jun) is newest
    expect(sortLeadItems(items, 'date', 'desc', 'published_at').map((i) => i.project.id)).toEqual([1, 2])
  })

  it('treats a null date as oldest (sinks to the end when desc)', () => {
    const items = [
      item({ id: 1, published_at: null }),
      item({ id: 2, published_at: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortLeadItems(items, 'date', 'desc', 'published_at').map((i) => i.project.id)).toEqual([2, 1])
  })

  it('sorts by value desc = highest first, missing value last', () => {
    const items = [
      item({ id: 1, estimated_value_cents: 50000 }),
      item({ id: 2, estimated_value_cents: null }),
      item({ id: 3, estimated_value_cents: 250000 }),
    ]
    expect(sortLeadItems(items, 'value', 'desc', 'created_at').map((i) => i.project.id)).toEqual([3, 1, 2])
  })
})

describe('pickSort', () => {
  it('flips direction when the active key is re-clicked', () => {
    expect(pickSort('date', { key: 'date', dir: 'desc' })).toEqual({ key: 'date', dir: 'asc' })
    expect(pickSort('date', { key: 'date', dir: 'asc' })).toEqual({ key: 'date', dir: 'desc' })
  })

  it('defaults a newly selected key (address→asc, date/value→desc)', () => {
    expect(pickSort('address', { key: 'date', dir: 'desc' })).toEqual({ key: 'address', dir: 'asc' })
    expect(pickSort('value', { key: 'address', dir: 'asc' })).toEqual({ key: 'value', dir: 'desc' })
  })
})
