import { NextRequest } from 'next/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  fetchResearchPurchase,
  resolveUserByHash,
} from '@/lib/queries'
import type { CityListWithStoragePath } from '@/lib/types'

/**
 * GET /api/download-research/[hash]/[city]
 *
 * Returns a 2-hour signed URL for the city research PDF in Supabase Storage.
 *
 * Authorization (defense in depth):
 *   1. hash must resolve to a non-deleted user (resolveUserByHash)
 *   2. user must own a research_purchases row for the requested city
 *   3. that row must have delivery_status='delivered' (gates pre-delivery
 *      research-in-progress requests, even though for v1 SJ-only this is
 *      always set on insert)
 *
 * Returns 404 (not 403) when:
 *   - city not found
 *   - user has not purchased
 *   - purchase exists but delivery_status != 'delivered'
 * Per design Locked Decision #16: don't leak ownership state via different
 * status codes. Treat "not yours" and "not yet delivered" as the same surface.
 *
 * Response shape: { url: string } on success, { error: string } on failure.
 */
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 2 // 2 hours

interface RouteParams {
  params: Promise<{ hash: string; city: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { hash, city } = await params

  if (!hash || !city) {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()

  const { user, error: userError } = await resolveUserByHash(supabase, hash)
  if (userError || !user) {
    return Response.json({ error: 'Invalid link.' }, { status: 403 })
  }

  // Look up the research-tier city_list (same disambiguation as the
  // checkout route — SJ has both 'report' and 'research' rows after
  // migration 004).
  const cityList = await fetchResearchCityListWithStoragePath(supabase, city)
  if (!cityList) {
    return Response.json({ error: 'Research not found.' }, { status: 404 })
  }

  const { purchase } = await fetchResearchPurchase(supabase, user.id, cityList.id)
  if (!purchase) {
    return Response.json({ error: 'Not purchased.' }, { status: 404 })
  }

  if (purchase.delivery_status !== 'delivered') {
    return Response.json({ error: 'Research not yet delivered.' }, { status: 404 })
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('city-lists-pdfs')
    .createSignedUrl(cityList.pdf_storage_path, SIGNED_URL_EXPIRES_IN)

  if (signError || !signed?.signedUrl) {
    return Response.json({ error: 'Could not generate download URL.' }, { status: 500 })
  }

  return Response.json(
    { url: signed.signedUrl },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

/**
 * Look up an active research-tier city_list row including pdf_storage_path.
 *
 * For server-side use only (signed URL generation after purchase verification).
 */
async function fetchResearchCityListWithStoragePath(
  supabase: SupabaseClient,
  city: string
): Promise<CityListWithStoragePath | null> {
  const { data } = await supabase
    .from('city_lists')
    .select(
      'id, city, year, title, description, headline_insight, headline_insight_subtext, price_cents, anchor_price_cents, active, service_tier, delivery_window_days, created_at, updated_at, pdf_storage_path'
    )
    .eq('city', city)
    .eq('active', true)
    .eq('service_tier', 'research')
    .maybeSingle()

  return (data as CityListWithStoragePath | null) ?? null
}
