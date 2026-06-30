import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listDrawings } from '@/lib/drawings'

function makeClient() {
  const storage = {
    from: vi.fn().mockReturnThis(),
    list: vi.fn(),
    createSignedUrls: vi.fn(),
  }
  const client = { storage } as unknown as SupabaseClient
  return { client, storage }
}

let mock: ReturnType<typeof makeClient>

beforeEach(() => {
  vi.clearAllMocks()
  mock = makeClient()
})

describe('listDrawings', () => {
  it('returns [] when the bucket/list errors (e.g. unconfigured locally)', async () => {
    mock.storage.list.mockResolvedValue({ data: null, error: { message: 'no bucket' } })
    expect(await listDrawings(mock.client, 7)).toEqual([])
    expect(mock.storage.createSignedUrls).not.toHaveBeenCalled()
  })

  it('returns [] (and skips signing) for an empty folder placeholder', async () => {
    mock.storage.list.mockResolvedValue({
      data: [{ name: '.emptyFolderPlaceholder' }],
      error: null,
    })
    expect(await listDrawings(mock.client, 7)).toEqual([])
    expect(mock.storage.createSignedUrls).not.toHaveBeenCalled()
  })

  it('returns signed download links for each file, prefixed by lead id', async () => {
    mock.storage.list.mockResolvedValue({
      data: [{ name: 'site-plan.pdf' }, { name: 'elevation.png' }],
      error: null,
    })
    mock.storage.createSignedUrls.mockResolvedValue({
      data: [
        { path: '7/site-plan.pdf', signedUrl: 'https://s/a', error: null },
        { path: '7/elevation.png', signedUrl: 'https://s/b', error: null },
      ],
      error: null,
    })

    const out = await listDrawings(mock.client, 7)

    expect(out).toEqual([
      { name: 'site-plan.pdf', url: 'https://s/a' },
      { name: 'elevation.png', url: 'https://s/b' },
    ])
    expect(mock.storage.from).toHaveBeenCalledWith('lead-drawings')
    expect(mock.storage.list).toHaveBeenCalledWith('7', expect.objectContaining({ limit: 100 }))
    expect(mock.storage.createSignedUrls).toHaveBeenCalledWith(
      ['7/site-plan.pdf', '7/elevation.png'],
      3600,
      { download: true }
    )
  })

  it('returns [] when signing fails outright', async () => {
    mock.storage.list.mockResolvedValue({ data: [{ name: 'a.pdf' }], error: null })
    mock.storage.createSignedUrls.mockResolvedValue({ data: null, error: { message: 'fail' } })
    expect(await listDrawings(mock.client, 7)).toEqual([])
  })

  it('skips individual files that failed to sign', async () => {
    mock.storage.list.mockResolvedValue({
      data: [{ name: 'a.pdf' }, { name: 'b.png' }],
      error: null,
    })
    mock.storage.createSignedUrls.mockResolvedValue({
      data: [
        { path: '7/a.pdf', signedUrl: 'https://s/a', error: null },
        { path: '7/b.png', signedUrl: null, error: { message: 'x' } },
      ],
      error: null,
    })
    expect(await listDrawings(mock.client, 7)).toEqual([{ name: 'a.pdf', url: 'https://s/a' }])
  })
})
