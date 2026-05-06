import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveAuthLogin } from '@/lib/auth-resolution'

/**
 * Mock Supabase chain that drains a FIFO queue of responses.
 *
 * Each `from(table)` returns a fresh chain that records the table.
 * `.maybeSingle()`, `.single()`, `.insert()`, and direct `await chain`
 * all pop the next response from the queue. Tests queue responses in
 * the exact order the implementation calls.
 */
function buildMockClient() {
  const responses: Array<{ data: unknown; error: { code?: string; message: string } | null }> = []
  const calls: Array<{ table: string; chain: string[] }> = []

  function nextResponse(label: string) {
    if (responses.length === 0) {
      throw new Error(`No queued response for ${label}; calls so far: ${JSON.stringify(calls)}`)
    }
    return responses.shift()!
  }

  const supabase = {
    from: vi.fn((table: string) => {
      const callRecord: { table: string; chain: string[] } = { table, chain: [] }
      calls.push(callRecord)

      const chain: Record<string, unknown> = {}
      const passthrough = ['select', 'eq', 'is', 'not', 'in', 'upsert', 'update']
      for (const method of passthrough) {
        chain[method] = vi.fn((...args: unknown[]) => {
          callRecord.chain.push(`${method}(${args.map((a) => JSON.stringify(a)).join(',')})`)
          return chain
        })
      }
      chain.insert = vi.fn(async (...args: unknown[]) => {
        callRecord.chain.push(`insert(${args.map((a) => JSON.stringify(a)).join(',')})`)
        return nextResponse(`insert(${table})`)
      })
      chain.maybeSingle = vi.fn(async () => {
        callRecord.chain.push('maybeSingle()')
        return nextResponse(`maybeSingle(${table})`)
      })
      chain.single = vi.fn(async () => {
        callRecord.chain.push('single()')
        return nextResponse(`single(${table})`)
      })
      // Direct await on chain (e.g. `await from('reveals').select(...)`)
      chain.then = (
        resolve: (value: unknown) => unknown,
        reject?: (err: unknown) => unknown
      ) => {
        callRecord.chain.push('await')
        const r = nextResponse(`await(${table})`)
        return Promise.resolve(r).then(resolve, reject)
      }

      return chain
    }),
    rpc: vi.fn(async (fnName: string) => {
      calls.push({ table: `rpc:${fnName}`, chain: ['call'] })
      return nextResponse(`rpc(${fnName})`)
    }),
  } as unknown as SupabaseClient

  return {
    supabase,
    queue: (response: { data: unknown; error?: { code?: string; message: string } | null }) => {
      responses.push({ data: response.data, error: response.error ?? null })
    },
    calls,
  }
}

const AUTH_USER_ID = '00000000-0000-0000-0000-000000000001'
const AUTH_EMAIL = 'test@example.com'

const STORED_USER = {
  id: 7,
  hash: 'existing_hash',
  name: null,
  company: null,
  email: AUTH_EMAIL,
  city_filter: null,
  source_campaign: null,
  created_at: '2026-01-01T00:00:00Z',
  last_seen_at: null,
  deleted_at: null,
  auth_user_id: null,
}

describe('resolveAuthLogin', () => {
  it('case 1: linked match — returns user, isNew=false', async () => {
    const { supabase, queue } = buildMockClient()
    const linked = { ...STORED_USER, auth_user_id: AUTH_USER_ID }
    queue({ data: linked }) // case 1 maybeSingle

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, AUTH_EMAIL)

    expect(result.user.id).toBe(7)
    expect(result.isNew).toBe(false)
    expect(result.forkAlert).toBeNull()
  })

  it('case 1 ignores soft-deleted rows (would fall through to case 4)', async () => {
    // Soft-deleted user with matching auth_user_id is filtered by the
    // `.is('deleted_at', null)` clause in the helper, so case 1 returns null.
    // The query proceeds to case 2, then 3, then 4 (insert).
    const { supabase, queue, calls } = buildMockClient()
    queue({ data: null }) // case 1 maybeSingle: not found (filtered out)
    queue({ data: null }) // case 2 maybeSingle
    queue({ data: null }) // case 3 maybeSingle
    queue({ data: { ...STORED_USER, auth_user_id: AUTH_USER_ID, hash: 'newhash' } }) // case 4 upsert.maybeSingle
    queue({ data: [] }) // listPaidUserIds: paid_user_ids RPC

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, AUTH_EMAIL)

    expect(result.isNew).toBe(true)
    // Verify the case 1 query applied the deleted_at filter
    const case1 = calls[0]
    expect(case1.chain.some((c) => c.includes('is("deleted_at",null)'))).toBe(true)
  })

  it('case 2: stale auth_user_id rotation — UPDATEs and returns user', async () => {
    const { supabase, queue, calls } = buildMockClient()
    const staleRow = { ...STORED_USER, auth_user_id: 'old-uuid' }
    const rotated = { ...staleRow, auth_user_id: AUTH_USER_ID }
    queue({ data: null }) // case 1
    queue({ data: staleRow }) // case 2 finds row
    queue({ data: rotated }) // setAuthUserId update.single

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, AUTH_EMAIL)

    expect(result.user.auth_user_id).toBe(AUTH_USER_ID)
    expect(result.isNew).toBe(false)
    // Verify case 2 query enforces deleted_at IS NULL
    const case2 = calls[1]
    expect(case2.chain.some((c) => c.includes('is("deleted_at",null)'))).toBe(true)
  })

  it('case 3: first link of existing user — UPDATEs and returns user', async () => {
    const { supabase, queue, calls } = buildMockClient()
    const unlinkedRow = { ...STORED_USER, auth_user_id: null }
    const linked = { ...unlinkedRow, auth_user_id: AUTH_USER_ID }
    queue({ data: null }) // case 1
    queue({ data: null }) // case 2
    queue({ data: unlinkedRow }) // case 3 finds row
    queue({ data: linked }) // setAuthUserId update.single

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, AUTH_EMAIL)

    expect(result.user.id).toBe(7)
    expect(result.user.auth_user_id).toBe(AUTH_USER_ID)
    expect(result.isNew).toBe(false)
    const case3 = calls[2]
    expect(case3.chain.some((c) => c.includes('is("deleted_at",null)'))).toBe(true)
    expect(case3.chain.some((c) => c.includes('is("auth_user_id",null)'))).toBe(true)
  })

  it('case 4: brand-new user — INSERTs and returns isNew=true with no fork', async () => {
    const { supabase, queue } = buildMockClient()
    const newUser = { ...STORED_USER, id: 99, hash: 'fresh_hash', auth_user_id: AUTH_USER_ID }
    queue({ data: null }) // case 1
    queue({ data: null }) // case 2
    queue({ data: null }) // case 3
    queue({ data: newUser }) // case 4 upsert.maybeSingle
    queue({ data: [] }) // listPaidUserIds: reveals (no paid users)
    queue({ data: [] }) // listPaidUserIds: list_purchases

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, AUTH_EMAIL)

    expect(result.isNew).toBe(true)
    expect(result.user.id).toBe(99)
    expect(result.forkAlert).toBeNull()
  })

  it('case 4 + fork detection: same_local_part match writes alert', async () => {
    const { supabase, queue, calls } = buildMockClient()
    const newUser = {
      ...STORED_USER,
      id: 99,
      hash: 'fresh',
      email: 'matthew@updatewave.com',
      auth_user_id: AUTH_USER_ID,
    }
    queue({ data: null }) // case 1
    queue({ data: null }) // case 2
    queue({ data: null }) // case 3
    queue({ data: newUser }) // case 4 upsert.maybeSingle
    queue({ data: [{ user_id: 50 }] }) // listPaidUserIds: paid_user_ids RPC (user 50 paid)
    queue({ data: [{ id: 50, email: 'matthew@gmail.com' }] }) // paidUsers query
    queue({ data: null }) // identity_fork_alerts insert

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, 'matthew@updatewave.com')

    expect(result.isNew).toBe(true)
    expect(result.forkAlert).toEqual({
      user_id_likely_old: 50,
      similarity_signal: 'same_local_part',
    })
    // Verify identity_fork_alerts.insert was called
    const alertCall = calls.find((c) => c.table === 'identity_fork_alerts')
    expect(alertCall).toBeDefined()
    expect(alertCall!.chain[0]).toContain('insert(')
    expect(alertCall!.chain[0]).toContain('"same_local_part"')
  })

  it('case 4 + fork detection: same_domain match writes alert', async () => {
    const { supabase, queue } = buildMockClient()
    const newUser = {
      ...STORED_USER,
      id: 99,
      hash: 'fresh',
      email: 'matthew@acme.com',
      auth_user_id: AUTH_USER_ID,
    }
    queue({ data: null })
    queue({ data: null })
    queue({ data: null })
    queue({ data: newUser })
    queue({ data: [{ user_id: 50 }] })
    queue({ data: [{ id: 50, email: 'matt@acme.com' }] }) // same domain, different local
    queue({ data: null }) // alert insert

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, 'matthew@acme.com')

    expect(result.forkAlert).toEqual({
      user_id_likely_old: 50,
      similarity_signal: 'same_domain',
    })
  })

  it('case 4 + fork detection: dissimilar paid email triggers no alert', async () => {
    const { supabase, queue } = buildMockClient()
    const newUser = {
      ...STORED_USER,
      id: 99,
      email: 'matthew@updatewave.com',
      auth_user_id: AUTH_USER_ID,
    }
    queue({ data: null })
    queue({ data: null })
    queue({ data: null })
    queue({ data: newUser })
    queue({ data: [{ user_id: 50 }] })
    queue({ data: [{ id: 50, email: 'totally-different@another.com' }] })

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, 'matthew@updatewave.com')

    expect(result.forkAlert).toBeNull()
  })

  it('case 4 race: upsert returns null (conflict) — re-queries case 1 and returns winner', async () => {
    const { supabase, queue } = buildMockClient()
    const winnerRow = { ...STORED_USER, id: 88, hash: 'tab1_hash', auth_user_id: AUTH_USER_ID }
    queue({ data: null }) // case 1: nothing yet
    queue({ data: null }) // case 2
    queue({ data: null }) // case 3
    queue({ data: null }) // case 4 upsert: conflict (ignoreDuplicates → null data)
    queue({ data: winnerRow }) // case 1 re-query finds the winner

    const result = await resolveAuthLogin(supabase, AUTH_USER_ID, AUTH_EMAIL)

    expect(result.isNew).toBe(false)
    expect(result.user.id).toBe(88)
    expect(result.forkAlert).toBeNull()
  })
})
