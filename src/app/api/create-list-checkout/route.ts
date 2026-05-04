import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createStripeClient } from '@/lib/stripe'
import { fetchCityList, fetchListPurchase, resolveUserByHash } from '@/lib/queries'

/**
 * Create a Stripe Checkout session for a city list purchase.
 *
 * Body: { hash: string, city: string }
 *
 * Mirrors the existing /api/create-checkout (reveal) pattern:
 *   - inline price_data (unit_amount from city_lists.price_cents)
 *   - metadata.product_type = 'list' for webhook dispatch
 *   - metadata carries hash + user_id + city_list_id for handleListPurchase
 *   - success_url goes to a city-scoped /success page
 *
 * Rate limiting: same gap as create-checkout — see TODOS.md (Upstash Redis).
 */
export async function POST(request: NextRequest) {
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
    return Response.json({ error: 'Missing or invalid fields: hash, city' }, { status: 400 })
  }

  const { hash, city } = body as { hash: string; city: string }

  const supabase = createSupabaseServiceClient()

  // Validate hash → get user (filters on deleted_at IS NULL)
  const { user, error: userError } = await resolveUserByHash(supabase, hash)
  if (userError || !user) {
    return Response.json({ error: 'Invalid link.' }, { status: 403 })
  }

  // Look up active city_list by slug
  const { cityList, error: cityListError } = await fetchCityList(supabase, city)
  if (cityListError || !cityList) {
    return Response.json({ error: 'Report not found.' }, { status: 404 })
  }

  // Already purchased? Short-circuit (idempotent). Returns a structured status
  // discriminator so the client doesn't have to match on a magic string.
  const { purchase: existingPurchase } = await fetchListPurchase(supabase, user.id, cityList.id)
  if (existingPurchase) {
    return Response.json({
      status: 'already_purchased' as const,
      redirectTo: `/list/${hash}/${city}/success`,
    })
  }

  // Create Stripe Checkout session.
  // Use env-based URL, never trust Origin header (open redirect risk).
  const stripe = createStripeClient()
  const origin =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Idempotency key: if the same user double-clicks Buy or opens two tabs and
  // both POST within ~24h, Stripe returns the SAME session URL instead of
  // creating two separate Checkout sessions. Prevents duplicate charges
  // before the (user_id, city_list_id) UNIQUE constraint catches the second insert.
  const idempotencyKey = `list:${user.id}:${cityList.id}`

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
      client_reference_id: `${hash}:list:${cityList.id}`,
      metadata: {
        product_type: 'list',
        hash,
        user_id: String(user.id),
        city_list_id: String(cityList.id),
        city,
      },
      success_url: `${origin}/list/${hash}/${city}/success`,
      cancel_url: `${origin}/list/${hash}/${city}`,
    },
    { idempotencyKey }
  )

  return Response.json({ status: 'checkout' as const, url: session.url })
}
