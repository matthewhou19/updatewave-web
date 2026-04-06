/**
 * Supabase query helpers for server components.
 *
 * Centralizes the explicit column list so architect fields are never
 * accidentally fetched for unrevealed projects. Defense-in-depth.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Project, User } from './types'

/**
 * Explicit columns for project listings. Architect fields are intentionally
 * excluded to prevent data leaks to the client.
 */
const PROJECT_LIST_COLUMNS =
  'id, city, address, project_type, estimated_value_cents, estimated_value, filing_date, source_url, status, reveal_count, published_at, updated_at, created_at'

/**
 * Fetch published projects without architect fields.
 * Sorted by filing_date descending (newest first).
 */
export async function fetchPublishedProjects(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_LIST_COLUMNS)
    .eq('status', 'published')
    .order('filing_date', { ascending: false })

  return { projects: (data ?? []) as Project[], error }
}

/**
 * Look up a user by their unique hash. Returns null if not found.
 */
export async function fetchUserByHash(supabase: SupabaseClient, hash: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('hash', hash)
    .single()

  return { user: data as User | null, error }
}

/**
 * Get the list of project IDs this user has revealed.
 */
export async function fetchUserReveals(supabase: SupabaseClient, userId: number) {
  const { data, error } = await supabase
    .from('reveals')
    .select('project_id')
    .eq('user_id', userId)

  const projectIds = (data ?? []).map((r: { project_id: number }) => r.project_id)
  return { revealedProjectIds: projectIds, error }
}

interface ArchitectInfo {
  architect_name: string | null
  architect_firm: string | null
  architect_contact: string | null
  architect_website: string | null
}

/**
 * Fetch architect data only for the given project IDs (revealed projects).
 * Returns a lookup map: projectId -> architect fields.
 */
export async function fetchArchitectData(
  supabase: SupabaseClient,
  projectIds: number[]
): Promise<Record<number, ArchitectInfo>> {
  if (projectIds.length === 0) return {}

  const { data } = await supabase
    .from('projects')
    .select('id, architect_name, architect_firm, architect_contact, architect_website')
    .in('id', projectIds)

  const result: Record<number, ArchitectInfo> = {}
  for (const rp of data ?? []) {
    result[rp.id] = {
      architect_name: rp.architect_name,
      architect_firm: rp.architect_firm,
      architect_contact: rp.architect_contact,
      architect_website: rp.architect_website,
    }
  }
  return result
}

/**
 * Merge architect data into projects. Unrevealed projects get null architect fields.
 */
export function mergeArchitectData(
  projects: Project[],
  architectData: Record<number, ArchitectInfo>
): Project[] {
  return projects.map((p) => {
    const arch = architectData[p.id]
    return {
      ...p,
      architect_name: arch?.architect_name ?? null,
      architect_firm: arch?.architect_firm ?? null,
      architect_contact: arch?.architect_contact ?? null,
      architect_website: arch?.architect_website ?? null,
    }
  })
}
