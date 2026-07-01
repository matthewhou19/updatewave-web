import { describe, it, expect } from 'vitest'
import { assembleBrowseProjects } from '../../src/lib/browse'
import type { Project } from '../../src/lib/types'

/**
 * assembleBrowseProjects builds the /browse view model. The security-critical
 * behaviour: an UNREVEALED lead must carry no owner email/phone in its
 * description and no drawing URLs; a REVEALED lead gets the raw description and
 * its drawings.
 */

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    city: 'palo-alto',
    address: '123 Colorado Ave',
    project_type: 'individual_review',
    estimated_value_cents: null,
    estimated_value: null,
    architect_name: null,
    architect_firm: null,
    architect_contact: null,
    architect_website: null,
    description: 'Construct a new 2-story residence. Zoning R-1.',
    source_permit_id: null,
    filing_date: '2026-06-01',
    source_url: null,
    status: 'published',
    reveal_count: 0,
    reviewed_at: null,
    published_at: '2026-06-02T00:00:00Z',
    updated_at: '2026-06-02T00:00:00Z',
    created_at: '2026-06-02T00:00:00Z',
    ...overrides,
  }
}

const OWNER_DESC =
  'Construct a new 2-story residence. Zoning R-1. ' +
  'Owner: Maor Greenberg (maor@spacial.io, 650-663-3339).'

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PHONE = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/

describe('assembleBrowseProjects', () => {
  it('unrevealed lead: description is owner-stripped, no drawings, manifest flags set', () => {
    const [vm] = assembleBrowseProjects({
      projects: [makeProject({ id: 1, description: OWNER_DESC })],
      revealedProjectIds: [],
      architectPresenceIds: [1],
      drawingProjectIds: [1],
      drawingsByProject: { 1: [{ name: 'plan.pdf', url: 'https://signed/plan' }] },
    })

    // Security: no owner contact leaks into the free description.
    expect(vm.description).not.toMatch(EMAIL)
    expect(vm.description).not.toMatch(PHONE)
    expect(vm.description).not.toContain('Owner:')
    // Manifest reflects what this lead contains.
    expect(vm.has_owner_contact).toBe(true)
    expect(vm.has_architect_contact).toBe(true)
    expect(vm.has_drawings).toBe(true)
    // No downloadable drawings before payment.
    expect(vm.drawings).toEqual([])
  })

  it('revealed lead: raw description (owner inline) + delivered drawings', () => {
    const drawings = [{ name: 'plan.pdf', url: 'https://signed/plan' }]
    const [vm] = assembleBrowseProjects({
      projects: [makeProject({ id: 1, description: OWNER_DESC })],
      revealedProjectIds: [1],
      architectPresenceIds: [1],
      drawingProjectIds: [1],
      drawingsByProject: { 1: drawings },
    })

    expect(vm.description).toBe(OWNER_DESC) // raw, owner inline
    expect(vm.drawings).toEqual(drawings)
  })

  it('flexible: a lead missing owner/architect/drawings shows all-false flags', () => {
    const [vm] = assembleBrowseProjects({
      projects: [makeProject({ id: 2, description: 'Plain scope. Zoning R-1.' })],
      revealedProjectIds: [],
      architectPresenceIds: [],
      drawingProjectIds: [],
      drawingsByProject: {},
    })

    expect(vm.has_owner_contact).toBe(false)
    expect(vm.has_architect_contact).toBe(false)
    expect(vm.has_drawings).toBe(false)
    expect(vm.drawings).toEqual([])
  })

  it('presence flags are keyed per project id (independent leads)', () => {
    const vms = assembleBrowseProjects({
      projects: [makeProject({ id: 1 }), makeProject({ id: 2 }), makeProject({ id: 3 })],
      revealedProjectIds: [],
      architectPresenceIds: [2],
      drawingProjectIds: [3],
      drawingsByProject: {},
    })

    expect(vms.find((v) => v.id === 1)!.has_architect_contact).toBe(false)
    expect(vms.find((v) => v.id === 2)!.has_architect_contact).toBe(true)
    expect(vms.find((v) => v.id === 3)!.has_drawings).toBe(true)
    expect(vms.find((v) => v.id === 2)!.has_drawings).toBe(false)
  })
})
