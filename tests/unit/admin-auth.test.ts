import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let cookieValue: string | undefined
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'uw_admin' && cookieValue !== undefined ? { value: cookieValue } : undefined,
      set: vi.fn(),
      delete: vi.fn(),
    }),
}))

const { checkAdminPassword, isAdminAuthed } = await import('@/lib/admin-auth')

async function token(pw: string): Promise<string> {
  const bytes = new TextEncoder().encode(`uw-admin:${pw}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

beforeEach(() => {
  cookieValue = undefined
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('checkAdminPassword', () => {
  it('false when ADMIN_PASSWORD unset (fail-closed)', () => {
    vi.stubEnv('ADMIN_PASSWORD', '')
    expect(checkAdminPassword('anything')).toBe(false)
  })

  it('true only for the exact password', () => {
    vi.stubEnv('ADMIN_PASSWORD', 's3cret-pass')
    expect(checkAdminPassword('s3cret-pass')).toBe(true)
    expect(checkAdminPassword('wrong')).toBe(false)
    expect(checkAdminPassword('s3cret-pas')).toBe(false) // length-off
  })
})

describe('isAdminAuthed', () => {
  it('false when ADMIN_PASSWORD unset', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '')
    cookieValue = 'whatever'
    expect(await isAdminAuthed()).toBe(false)
  })

  it('false when there is no cookie', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 's3cret-pass')
    cookieValue = undefined
    expect(await isAdminAuthed()).toBe(false)
  })

  it('false when the cookie token does not match', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 's3cret-pass')
    cookieValue = await token('different-pass')
    expect(await isAdminAuthed()).toBe(false)
  })

  it('true when the cookie token matches the password', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 's3cret-pass')
    cookieValue = await token('s3cret-pass')
    expect(await isAdminAuthed()).toBe(true)
  })
})
