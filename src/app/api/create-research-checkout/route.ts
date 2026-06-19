import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createStripeClient, ensureStripeConfigured } from '@/lib/stripe'
import {
  fetchResearchPurchase,
  resolveUserByHash,
} from '@/lib/queries'
import type { CityList } from '@/lib/types'
import { SupabaseClient } from '@supabase/supabase-js'
import { resolveBaseUrl } from '@/lib/site-url'

/**
 * Create a Stripe Checkout session for a city RESEARCH purchase ($1,999 SKU).
 *
 * Body: { hash: string, city: string }
 *
 * Mirrors /api/create-list-checkout but targets the service_tier='research'
 * row in city_lists. The (city, year, service_tier) UNIQUE from migration 004
 * means the city slug alone is ambiguous (one row for $499 report + one for
 * $1999 research), so we filter explicitly.
 *
 *   - inline price_data (unit_amount from city_lists.price_cents)
 *   - metadata.product_type = 'research' for webhook dispatch
 *   - metadata carries hash + user_id + city_list_id + city for handleResearchPurchase
 *   - success_url goes to a city-scoped /research/[hash]/[city]/status page
 *
 * Rate limiting: same gap as create-list-checkout — see TODOS.md (Upstash Redis).
 */
export async function POST(request: NextRequest) {
  const stripeNotConfigured = ensureStripeConfigured()
  if (stripeNotConfigured) return stripeNotConfigured

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).hash !== 'string' ||
    typeof (body as Record<string, unknown>).city !== 'string'
  ) {
    return Response.json(
      { error: 'Missing or invalid fields: hash, city' },
      { status: 400 }
    )
  }

  const { hash, city } = body as { hash: string; city: string }

  const supabase = createSupabaseServiceClient()

  // Validate hash → get user (filters on deleted_at IS NULL)
  const { user, error: userError } = await resolveUserByHash(supabase, hash)
  if (userError || !user) {
    return Response.json({ error: 'Invalid link.' }, { status: 403 })
  }

  // Look up active RESEARCH-tier city_list by slug (not the $499 report row)
  const cityList = await fetchResearchCityListBySlug(supabase, city)
  if (!cityList) {
    return Response.json({ error: 'Research not available for this city.' }, { status: 404 })
  }

  // Already purchased? Short-circuit (idempotent). Returns a structured status
  // discriminator so the client doesn't have to match on a magic string.
  const { purchase: existingPurchase } = await fetchResearchPurchase(
    supabase,
    user.id,
    cityList.id
  )
  if (existingPurchase) {
    return Response.json({
      status: 'already_purchased' as const,
      redirectTo: `/research/${hash}/${city}/status`,
    })
  }

  // Create Stripe Checkout session.
  // resolveBaseUrl() sanitizes the env value so a malformed NEXT_PUBLIC_BASE_URL
  // can't produce a non-ASCII success_url that Stripe rejects (2026-06-19 outage).
  const stripe = createStripeClient()
  const origin = resolveBaseUrl()

  // Idempotency key: if the same user double-clicks Buy or opens two tabs and
  // both POST within ~24h, Stripe returns the SAME session URL instead of
  // creating two separate Checkout sessions. Prevents duplicate charges before
  // the (user_id, city_list_id) UNIQUE constraint catches the second insert.
  const idempotencyKey = `research:${user.id}:${cityList.id}`

  const session = await stripe.checkout.sessions.create(
    {
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: cityList.title,
            },
            unit_amount: cityList.price_cents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      client_reference_id: `${hash}:research:${cityList.id}`,
      metadata: {
        product_type: 'research',
        hash,
        user_id: String(user.id),
        city_list_id: String(cityList.id),
        city,
      },
      success_url: `${origin}/research/${hash}/${city}/status`,
      cancel_url: `${origin}/research/${hash}`,
    },
    { idempotencyKey }
  )

  return Response.json({ status: 'checkout' as const, url: session.url })
}

/**
 * Look up an active research-tier city_list row by city slug.
 *
 * The (city, year, service_tier) UNIQUE constraint allows one row per
 * (city, year, tier). Filter on service_tier='research' so we never
 * accidentally pick up the $499 report row for SJ.
 */
async function fetchResearchCityListBySlug(
  supabase: SupabaseClient,
  city: string
): Promise<CityList | null> {
  const { data } = await supabase
    .from('city_lists')
    .select(
      'id, city, year, title, description, headline_insight, headline_insight_subtext, price_cents, anchor_price_cents, active, service_tier, delivery_window_days, created_at, updated_at'
    )
    .eq('city', city)
    .eq('active', true)
    .eq('service_tier', 'research')
    .maybeSingle()

  return (data as CityList | null) ?? null
}
