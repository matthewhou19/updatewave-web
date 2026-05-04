import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  fetchCityListWithStoragePath,
  fetchListPurchase,
  resolveUserByHash,
} from '@/lib/queries'

/**
 * GET /api/download-list/[hash]/[city]
 *
 * Returns a 2-hour signed URL for the city report PDF in Supabase Storage.
 * Authorization: hash must resolve to a non-deleted user with an existing
 * list_purchases row for the requested city.
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

  const { cityList, error: cityListError } = await fetchCityListWithStoragePath(supabase, city)
  if (cityListError || !cityList) {
    return Response.json({ error: 'Report not found.' }, { status: 404 })
  }

  const { purchase } = await fetchListPurchase(supabase, user.id, cityList.id)
  if (!purchase) {
    return Response.json({ error: 'Not purchased.' }, { status: 403 })
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('city-lists-pdfs')
    .createSignedUrl(cityList.pdf_storage_path, SIGNED_URL_EXPIRES_IN)

  if (signError || !signed?.signedUrl) {
    return Response.json({ error: 'Could not generate download URL.' }, { status: 500 })
  }

  // The signed URL grants 2 hours of access. Prevent any cache layer (browser,
  // CDN, proxy) from holding onto the response.
  return Response.json(
    { url: signed.signedUrl },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
