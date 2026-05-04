import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { createStripeClient } from '@/lib/stripe'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { fetchCityList, resolveUserByHash } from '@/lib/queries'

const REVEAL_PRICE_CENTS = 2500

/**
 * Stripe webhook handler.
 *
 * Dispatches on session.metadata.product_type:
 *   'reveal' (default for legacy compatibility) → handleRevealPurchase
 *   'list'                                       → handleListPurchase
 *
 * Idempotency: both branches rely on UNIQUE constraints catching duplicate
 * Stripe deliveries (reveals.user_id+project_id, list_purchases.user_id+city_list_id).
 * On a 23505 duplicate-key error we return 200 OK silently.
 *
 * Soft-delete: user lookup uses resolveUserByHash which filters on
 * deleted_at IS NULL, so a user soft-deleted between checkout and webhook
 * delivery does not receive a record.
 */
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const rawBody = await request.text()

  let event: Stripe.Event
  const stripe = createStripeClient()

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return Response.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session

  // Guard 1: payment must have actually been captured. checkout.session.completed
  // can fire for async-payment-pending sessions (Cash App, ACH, Klarna). Inserting
  // before the money is captured = giving the product away if payment fails.
  if (session.payment_status !== 'paid') {
    return Response.json({ received: true })
  }

  const supabase = createSupabaseServiceClient()
  const productType = session.metadata?.product_type ?? 'reveal'

  if (productType === 'list') {
    return handleListPurchase(session, supabase)
  }

  // Default branch: reveal (covers legacy sessions without metadata)
  return handleRevealPurchase(session, supabase)
}

async function handleRevealPurchase(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  const clientRef = session.client_reference_id
  if (!clientRef) {
    return Response.json({ received: true })
  }

  const colonIndex = clientRef.indexOf(':')
  if (colonIndex === -1) {
    return Response.json({ received: true })
  }

  const hash = clientRef.slice(0, colonIndex)
  const projectIdStr = clientRef.slice(colonIndex + 1)
  const projectId = parseInt(projectIdStr, 10)

  if (!hash || isNaN(projectId)) {
    return Response.json({ received: true })
  }

  const { user } = await resolveUserByHash(supabase, hash)
  if (!user) {
    // Either invalid hash or user soft-deleted. Idempotent no-op.
    return Response.json({ received: true })
  }

  // Guard: amount must match the expected reveal price. Catches Stripe coupons
  // or any session creation bug that would credit a reveal at $0.
  if (session.amount_total !== REVEAL_PRICE_CENTS) {
    console.warn('[webhook:reveal] amount mismatch', {
      expected: REVEAL_PRICE_CENTS,
      received: session.amount_total,
    })
    return Response.json({ received: true })
  }

  const stripePaymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  const { error: insertError } = await supabase.from('reveals').insert({
    user_id: user.id,
    project_id: projectId,
    stripe_payment_id: stripePaymentId,
    amount_cents: session.amount_total,
  })

  if (insertError) {
    const isDuplicate =
      insertError.code === '23505' ||
      (insertError.message && insertError.message.includes('unique'))
    if (!isDuplicate) {
      return Response.json({ error: 'Failed to record reveal' }, { status: 500 })
    }
  }

  return Response.json({ received: true })
}

async function handleListPurchase(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  const userIdStr = session.metadata?.user_id
  const cityListIdStr = session.metadata?.city_list_id
  const hash = session.metadata?.hash

  if (!userIdStr || !cityListIdStr || !hash) {
    // Defensive: list metadata required. Log and 200 to prevent Stripe retry.
    console.warn('[webhook:list] missing metadata', { hasUserId: !!userIdStr, hasCityListId: !!cityListIdStr, hasHash: !!hash })
    return Response.json({ received: true })
  }

  const userId = parseInt(userIdStr, 10)
  const cityListId = parseInt(cityListIdStr, 10)

  if (isNaN(userId) || isNaN(cityListId)) {
    console.warn('[webhook:list] non-numeric metadata ids')
    return Response.json({ received: true })
  }

  // Re-resolve via hash to honor soft-delete: even if metadata.user_id is set,
  // a user soft-deleted between checkout and webhook should not receive purchase.
  const { user } = await resolveUserByHash(supabase, hash)
  if (!user || String(user.id) !== userIdStr) {
    return Response.json({ received: true })
  }

  // Look up the city_list to validate the paid amount matches expected price.
  // Fetches the city_list by id (we know city_list_id from metadata, but the
  // helper queries by city slug — derive city from metadata as defense in depth).
  const cityFromMetadata = session.metadata?.city
  if (!cityFromMetadata) {
    console.warn('[webhook:list] missing city in metadata')
    return Response.json({ received: true })
  }
  const { cityList } = await fetchCityList(supabase, cityFromMetadata)
  if (!cityList || cityList.id !== cityListId) {
    console.warn('[webhook:list] city_list mismatch or not found')
    return Response.json({ received: true })
  }
  if (session.amount_total !== cityList.price_cents) {
    console.warn('[webhook:list] amount mismatch', {
      expected: cityList.price_cents,
      received: session.amount_total,
    })
    return Response.json({ received: true })
  }

  const stripePaymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  const { error: insertError } = await supabase.from('list_purchases').insert({
    user_id: user.id,
    city_list_id: cityListId,
    stripe_session_id: session.id,
    stripe_payment_id: stripePaymentId,
    amount_cents: session.amount_total,
  })

  if (insertError) {
    const isDuplicate =
      insertError.code === '23505' ||
      (insertError.message && insertError.message.includes('unique'))
    if (!isDuplicate) {
      return Response.json({ error: 'Failed to record list purchase' }, { status: 500 })
    }
  }

  return Response.json({ received: true })
}
