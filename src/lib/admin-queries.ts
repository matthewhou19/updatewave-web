/**
 * Supabase query helpers for the admin review surface.
 *
 * Kept separate from queries.ts on purpose: queries.ts centralizes a column
 * allowlist that deliberately EXCLUDES architect fields so they never leak to
 * public reads. The admin reviewing a candidate needs the opposite — every
 * field, including architect contact info. Mixing the two would blur that
 * defense-in-depth boundary. Everything here is service-role / admin-gated only
 * and must never back a public route.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Project } from './types'

const PROJECT_ADMIN_COLUMNS =
  'id, city, address, project_type, estimated_value_cents, estimated_value, description, architect_name, architect_firm, architect_contact, architect_website, source_permit_id, filing_date, last_action_date, last_action_summary, source_url, status, reveal_count, reviewed_at, published_at, updated_at, created_at'

/**
 * Fetch all leads awaiting review (status='candidate'), newest first.
 * Service-role only — RLS hides candidates from anon.
 */
export async function fetchCandidateProjects(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_ADMIN_COLUMNS)
    .eq('status', 'candidate')
    .order('created_at', { ascending: false })

  return { projects: (data ?? []) as Project[], error }
}

/**
 * Fetch published (live) leads for the admin review surface so the owner can
 * withdraw approval. Newest-published first. Service-role only.
 */
export async function fetchPublishedProjectsForReview(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_ADMIN_COLUMNS)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  return { projects: (data ?? []) as Project[], error }
}
