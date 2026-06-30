import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Read at action-call time, so per-test assignment is picked up.
let isAuthed: boolean
vi.mock('@/lib/admin-auth', () => ({
  isAdminAuthed: () => Promise.resolve(isAuthed),
}))

let mockServiceClient: ReturnType<typeof makeServiceClient>
vi.mock('@/lib/supabase', () => ({
  createSupabaseServiceClient: () => mockServiceClient,
}))

const { approveLead, rejectLead } = await import('../../src/app/admin/leads/actions')

function makeServiceClient(
  updateResult: { data: unknown; error: unknown },
  insertResult: { error: unknown } = { error: null }
) {
  const updateChain = {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue(updateResult),
  }
  const insert = vi.fn().mockResolvedValue(insertResult)
  const from = vi.fn((table: string) =>
    table === 'project_status_log' ? { insert } : updateChain
  )
  return { from, _updateChain: updateChain, _insert: insert }
}

beforeEach(() => {
  vi.clearAllMocks()
  isAuthed = true
  mockServiceClient = makeServiceClient({ data: [{ id: 7 }], error: null })
})

describe('approveLead', () => {
  it('rejects an unauthenticated caller and never touches the DB', async () => {
    isAuthed = false
    const res = await approveLead(7)
    expect(res).toEqual({ ok: false, error: 'Not authorized.' })
    expect(mockServiceClient.from).not.toHaveBeenCalled()
  })

  it('rejects an invalid id', async () => {
    const res = await approveLead(0)
    expect(res).toEqual({ ok: false, error: 'Invalid lead id.' })
    expect(mockServiceClient.from).not.toHaveBeenCalled()
  })

  it('publishes a candidate with the status guard and writes the audit log', async () => {
    const res = await approveLead(7)
    expect(res).toEqual({ ok: true })

    const patch = mockServiceClient._updateChain.update.mock.calls[0][0]
    expect(patch.status).toBe('published')
    expect(patch.published_at).toBeTruthy()
    expect(patch.reviewed_at).toBeTruthy()

    expect(mockServiceClient._updateChain.eq).toHaveBeenCalledWith('id', 7)
    expect(mockServiceClient._updateChain.eq).toHaveBeenCalledWith('status', 'candidate')

    expect(mockServiceClient._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 7,
        old_status: 'candidate',
        new_status: 'published',
        changed_by: 'admin',
      })
    )
  })

  it('is idempotent: 0 rows changed → no log, reports already-processed', async () => {
    mockServiceClient = makeServiceClient({ data: [], error: null })
    const res = await approveLead(7)
    expect(res).toEqual({ ok: false, error: 'Already processed (no longer a candidate).' })
    expect(mockServiceClient._insert).not.toHaveBeenCalled()
  })

  it('surfaces a DB error and skips logging', async () => {
    mockServiceClient = makeServiceClient({ data: null, error: { message: 'boom' } })
    const res = await approveLead(7)
    expect(res).toEqual({ ok: false, error: 'Database error. Try again.' })
    expect(mockServiceClient._insert).not.toHaveBeenCalled()
  })
})

describe('rejectLead', () => {
  it('archives a candidate (no published_at) and logs archived', async () => {
    const res = await rejectLead(7)
    expect(res).toEqual({ ok: true })

    const patch = mockServiceClient._updateChain.update.mock.calls[0][0]
    expect(patch.status).toBe('archived')
    expect(patch.published_at).toBeUndefined()
    expect(patch.reviewed_at).toBeTruthy()

    expect(mockServiceClient._insert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 7, new_status: 'archived' })
    )
  })
})
