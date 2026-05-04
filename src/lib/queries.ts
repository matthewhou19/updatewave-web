/**
 * Supabase query helpers for server components.
 *
 * Centralizes the explicit column list so architect fields are never
 * accidentally fetched for unrevealed projects. Defense-in-depth.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { CityList, CityListWithStoragePath, ListPurchase, Project, User } from './types'

/**
 * Explicit columns for project listings. Architect fields are intentionally
 * excluded to prevent data leaks to the client.
 */
const PROJECT_LIST_COLUMNS =
  'id, city, address, description, project_type, estimated_value_cents, estimated_value, filing_date, source_url, status, reveal_count, published_at, updated_at, created_at'

/**
 * Public columns for city_lists. pdf_storage_path is intentionally excluded
 * to prevent leaking the storage path to the client. Only the download API
 * (server-side, with purchase verification) reads pdf_storage_path.
 */
const CITY_LIST_PUBLIC_COLUMNS =
  'id, city, year, title, description, headline_insight, headline_insight_subtext, price_cents, anchor_price_cents, active, created_at, updated_at'

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
 *
 * NOTE: this helper does not filter on deleted_at. For payment-critical paths
 * (webhook handlers, checkout creators, downloads) use resolveUserByHash instead,
 * which enforces the soft-delete filter.
 *
 * Tracked: TODOS.md "Soft-Delete on Read Paths — fetchUserByHash" — read pages
 * (browse, reveals) intentionally do not enforce soft-delete yet to keep the
 * SJ list product PR scope tight.
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
 * Resolve a user by hash for payment-critical paths.
 * Filters on deleted_at IS NULL to honor soft-delete (migration 001).
 *
 * Returns the user row or null. Used by:
 *   - POST /api/webhook (both reveal + list branches)
 *   - POST /api/create-checkout (reveal flow)
 *   - POST /api/create-list-checkout (list flow)
 *   - GET  /api/download-list (list download)
 */
export async function resolveUserByHash(supabase: SupabaseClient, hash: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, hash')
    .eq('hash', hash)
    .is('deleted_at', null)
    .single()

  return { user: (data as Pick<User, 'id' | 'hash'> | null), error }
}

/**
 * Fetch a city_list by its slug (city column doubles as URL slug).
 * Only returns active rows. Public columns only — does NOT include pdf_storage_path.
 */
export async function fetchCityList(supabase: SupabaseClient, city: string) {
  const { data, error } = await supabase
    .from('city_lists')
    .select(CITY_LIST_PUBLIC_COLUMNS)
    .eq('city', city)
    .eq('active', true)
    .single()

  return { cityList: (data as CityList | null), error }
}

/**
 * Fetch a city_list INCLUDING pdf_storage_path. For server-side use only
 * (download API after purchase verification). Never expose this result to
 * the client.
 */
export async function fetchCityListWithStoragePath(supabase: SupabaseClient, city: string) {
  const { data, error } = await supabase
    .from('city_lists')
    .select(`${CITY_LIST_PUBLIC_COLUMNS}, pdf_storage_path`)
    .eq('city', city)
    .eq('active', true)
    .single()

  return { cityList: (data as CityListWithStoragePath | null), error }
}

/**
 * Look up an existing purchase. Returns the row or null.
 */
export async function fetchListPurchase(
  supabase: SupabaseClient,
  userId: number,
  cityListId: number
) {
  const { data, error } = await supabase
    .from('list_purchases')
    .select('*')
    .eq('user_id', userId)
    .eq('city_list_id', cityListId)
    .single()

  return { purchase: (data as ListPurchase | null), error }
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
