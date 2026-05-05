/**
 * Supabase query helpers for server components.
 *
 * Centralizes the explicit column list so architect fields are never
 * accidentally fetched for unrevealed projects. Defense-in-depth.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import {
  CityList,
  CityListWithStoragePath,
  DigestSubscription,
  ListPurchase,
  Project,
  ResearchPurchase,
  User,
} from './types'

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
 *
 * service_tier and delivery_window_days are added by migration 003 to support
 * the $1999 research SKU; safe to expose publicly.
 */
const CITY_LIST_PUBLIC_COLUMNS =
  'id, city, year, title, description, headline_insight, headline_insight_subtext, price_cents, anchor_price_cents, active, service_tier, delivery_window_days, created_at, updated_at'

/**
 * Public columns for research_purchases. Mirrors CITY_LIST_PUBLIC_COLUMNS
 * pattern: full row is safe to expose to the row's owner (no secret-bearing
 * columns), but the constant exists so future schema additions stay
 * intentional rather than implicit on `select('*')`.
 */
export const RESEARCH_PURCHASE_PUBLIC_COLUMNS =
  'id, user_id, city_list_id, stripe_session_id, stripe_payment_id, amount_cents, delivery_status, digest_subscription_until, purchased_at, delivered_at'

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

/**
 * Fetch all active city_lists rows with service_tier='research'.
 * Used by /research/[hash] to populate the Bay Area city dropdown.
 *
 * Public columns only — does NOT include pdf_storage_path.
 * Sorted alphabetically by city slug per design Locked Decision #23.
 */
export async function fetchActiveResearchCities(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('city_lists')
    .select(CITY_LIST_PUBLIC_COLUMNS)
    .eq('active', true)
    .eq('service_tier', 'research')
    .order('city', { ascending: true })

  return { cityLists: ((data ?? []) as CityList[]), error }
}

/**
 * Look up an existing research purchase. Returns the row or null.
 *
 * Used by:
 *   - /research/[hash]/[city]/status (read state for delivery status display)
 *   - /api/webhook handleResearchPurchase (idempotency check before insert)
 *   - /api/download-research/[hash]/[city] (delivered-only download gate)
 */
export async function fetchResearchPurchase(
  supabase: SupabaseClient,
  userId: number,
  cityListId: number
) {
  const { data, error } = await supabase
    .from('research_purchases')
    .select(RESEARCH_PURCHASE_PUBLIC_COLUMNS)
    .eq('user_id', userId)
    .eq('city_list_id', cityListId)
    .single()

  return { purchase: (data as ResearchPurchase | null), error }
}

/**
 * Detect $349-then-$1999 SJ collision before rendering the /research dropdown.
 *
 * Returns whether the user already owns the $349 city report for the given
 * city_list_id. The /research page uses this to surface the SJ collision
 * warning copy per design Locked Decision #20.
 *
 * Mirrors fetchListPurchase but exposes a boolean instead of the row, since
 * the call site only needs presence/absence.
 */
export async function fetchListPurchaseForCollisionCheck(
  supabase: SupabaseClient,
  userId: number,
  cityListId: number
): Promise<{ owns: boolean; error: unknown }> {
  const { data, error } = await supabase
    .from('list_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('city_list_id', cityListId)
    .maybeSingle()

  return { owns: data !== null, error }
}

/**
 * Create a digest_subscriptions row for a fresh research_purchase.
 *
 * Generates the unsubscribe_token via crypto.randomUUID() (URL-safe, 36 chars,
 * sufficient entropy for the use case — token is the only auth on the public
 * /unsubscribe/[token] page).
 *
 * Returns the inserted row. The caller (webhook handleResearchPurchase) is
 * responsible for handling the case where research_purchase already has a
 * digest_subscriptions row (no UNIQUE constraint on research_purchase_id —
 * by design, in case the digest is ever re-subscribed after unsubscribe).
 */
export async function createDigestSubscription(
  supabase: SupabaseClient,
  researchPurchaseId: number,
  city: string
) {
  const unsubscribeToken = crypto.randomUUID()

  const { data, error } = await supabase
    .from('digest_subscriptions')
    .insert({
      research_purchase_id: researchPurchaseId,
      city,
      unsubscribe_token: unsubscribeToken,
      active: true,
    })
    .select()
    .single()

  return { subscription: (data as DigestSubscription | null), error }
}
