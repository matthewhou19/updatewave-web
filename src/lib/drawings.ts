import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Optional architectural drawings attached to a lead.
 *
 * Files live in a PRIVATE Supabase Storage bucket at
 * `lead-drawings/{projectId}/<filename>`. We list whatever is under the
 * lead's prefix and hand back short-lived signed URLs — no DB column needed,
 * which naturally supports 0 / 1 / many files per lead and means the AI writer
 * only has to drop files in the prefix.
 */

export const DRAWINGS_BUCKET = 'lead-drawings'

const SIGNED_URL_EXPIRES_IN = 60 * 60 // 1 hour

export interface Drawing {
  name: string
  url: string
}

/**
 * List a lead's drawings as signed download URLs.
 *
 * Returns [] when the lead has no drawings, or on ANY error (e.g. the bucket
 * isn't configured in local dev) — the caller simply renders nothing. A
 * service-role client is required because the bucket is private.
 */
export async function listDrawings(
  supabase: SupabaseClient,
  projectId: number
): Promise<Drawing[]> {
  const prefix = String(projectId)

  const { data: files, error: listError } = await supabase.storage
    .from(DRAWINGS_BUCKET)
    .list(prefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } })

  if (listError || !files) return []

  // Supabase returns a `.emptyFolderPlaceholder` sentinel for empty prefixes.
  const names = files
    .map((f) => f.name)
    .filter((name) => name && name !== '.emptyFolderPlaceholder')

  if (names.length === 0) return []

  const paths = names.map((name) => `${prefix}/${name}`)

  const { data: signed, error: signError } = await supabase.storage
    .from(DRAWINGS_BUCKET)
    // download: true puts `content-disposition: attachment` on the signed URL,
    // so clicking downloads the file instead of previewing it inline in the
    // browser. (The <a download> attribute is ignored for cross-origin URLs, so
    // this is the part that actually forces a download.)
    .createSignedUrls(paths, SIGNED_URL_EXPIRES_IN, { download: true })

  if (signError || !signed) return []

  // createSignedUrls preserves input order; align names by index.
  const drawings: Drawing[] = []
  signed.forEach((entry, i) => {
    if (entry.signedUrl && !entry.error) {
      drawings.push({ name: names[i], url: entry.signedUrl })
    }
  })

  return drawings
}

/**
 * IDs of leads that have at least one drawing, for the pre-reveal manifest
 * ("this lead includes architectural drawings"). One listing of the bucket
 * root: each lead's files live under a `{projectId}/` prefix, so the root
 * entries are exactly the project-id folders that contain files.
 *
 * Presence only — no signed URLs are minted here, so nothing downloadable
 * leaks before payment. Returns [] on any error (e.g. bucket absent in dev).
 *
 * Note: the root listing is capped (limit 1000); fine at current scale. If the
 * published set ever exceeds that, switch to a maintained `drawings_count`
 * column.
 */
export async function fetchDrawingProjectIds(
  supabase: SupabaseClient
): Promise<number[]> {
  const { data, error } = await supabase.storage
    .from(DRAWINGS_BUCKET)
    .list('', { limit: 1000 })

  if (error || !data) return []

  return data
    .map((entry) => entry.name)
    .filter((name) => name && name !== '.emptyFolderPlaceholder')
    .map((name) => Number(name))
    .filter((id) => Number.isInteger(id) && id > 0)
}

/**
 * Signed drawing URLs for the given (revealed) leads, keyed by project id.
 * Only leads with ≥1 drawing appear in the map. Call with revealed ids only —
 * this mints downloadable URLs, so it is a post-payment delivery step.
 */
export async function fetchDrawingsForProjects(
  supabase: SupabaseClient,
  projectIds: number[]
): Promise<Record<number, Drawing[]>> {
  if (projectIds.length === 0) return {}

  const entries = await Promise.all(
    projectIds.map(async (id) => [id, await listDrawings(supabase, id)] as const)
  )

  const result: Record<number, Drawing[]> = {}
  for (const [id, drawings] of entries) {
    if (drawings.length > 0) result[id] = drawings
  }
  return result
}
