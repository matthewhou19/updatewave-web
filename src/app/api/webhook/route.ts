import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { createStripeClient } from '@/lib/stripe'
import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  createDigestSubscription,
  resolveUserByHash,
} from '@/lib/queries'
import type { CityList, ProductType } from '@/lib/types'

const REVEAL_PRICE_CENTS = 2500

/**
 * Stripe webhook handler.
 *
 * Dispatches on session.metadata.product_type:
 *   'reveal' (default for legacy compatibility) -> handleRevealPurchase
 *   'list'                                       -> handleListPurchase
 *   'research'                                   -> handleResearchPurchase
 *
 * Idempotency: each branch relies on a UNIQUE constraint catching duplicate
 * Stripe deliveries:
 *   - reveals.user_id+project_id
 *   - list_purchases.user_id+city_list_id
 *   - research_purchases.user_id+city_list_id
 * On a 23505 duplicate-key error we return 200 OK silently.
 *
 * Soft-delete: user lookup uses resolveUserByHash which filters on
 * deleted_at IS NULL, so a user soft-deleted between checkout and webhook
 * delivery does not receive a record.
 *
 * Per design Locked Decision #17, list and research share the same shape
 * (look up user by hash, validate amount against expected price, insert into
 * a per-product purchases table with optional post-insert side-effect). The
 * shared logic lives in processCityProductPurchase below; both handlers are
 * thin adapters that bind the table-specific config and side effect.
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
    return Response.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
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
  const productType = (session.metadata?.product_type ?? 'reveal') as ProductType

  if (productType === 'list') {
    return handleListPurchase(session, supabase)
  }

  if (productType === 'research') {
    return handleResearchPurchase(session, supabase)
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

// ─────────────────────────────────────────────────────────────────────────
// Shared city-product helper (extracted per design Locked Decision #17)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Logging label for warnings from the shared helper. Distinct labels per
 * branch make grep'ing CloudWatch / Vercel logs trivial.
 */
type ProductLabel = 'list' | 'research'

/**
 * Build a record to insert into the per-product purchases table from the
 * shared inputs (user, city_list, session). Each branch knows its own
 * column shape — this lets handleListPurchase omit delivery_status while
 * handleResearchPurchase computes it from city_list.delivery_window_days.
 */
type BuildInsertRow = (input: {
  userId: number
  cityList: CityList
  session: Stripe.Checkout.Session
  stripePaymentId: string | null
}) => Record<string, unknown>

/**
 * Optional side effect run AFTER a successful insert (research uses this to
 * create the digest_subscriptions row). Receives the supabase client and the
 * city_list (so the side effect knows the city slug for denormalization).
 *
 * For list (no side effect) the helper is undefined. For research it inserts
 * the digest subscription and logs the (non-fatal) error if it fails.
 */
type AfterInsertSideEffect = (input: {
  supabase: SupabaseClient
  userId: number
  cityList: CityList
  insertedRow: Record<string, unknown> | null
  session: Stripe.Checkout.Session
}) => Promise<void>

interface ProcessCityProductConfig {
  /** 'list' | 'research' — used in console.warn labels. */
  label: ProductLabel
  /** Supabase table name to insert into. */
  table: 'list_purchases' | 'research_purchases'
  /** Build the insert payload from validated inputs. */
  buildInsert: BuildInsertRow
  /** Optional post-insert side effect (digest subscription for research). */
  afterInsert?: AfterInsertSideEffect
}

/**
 * Shared validation + insert pipeline for city-product purchases.
 *
 * Both list (Lane A) and research (Lane B) pay-then-deliver flows go through
 * identical front-half logic:
 *   1. Validate metadata (hash, user_id, city_list_id, city)
 *   2. Re-resolve user by hash (honors soft-delete)
 *   3. Look up city_list via fetchCityList (active filter)
 *   4. Verify city_list.id matches metadata.city_list_id (defense in depth)
 *   5. Verify amount_total === city_list.price_cents (catches coupon abuse)
 *   6. Insert into the per-product purchases table (idempotent on UNIQUE)
 *   7. Optional post-insert side effect (digest sub for research)
 *
 * Returns the Response to send back to Stripe. Callers should `return` this
 * value directly.
 */
async function processCityProductPurchase(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient,
  config: ProcessCityProductConfig
): Promise<Response> {
  const userIdStr = session.metadata?.user_id
  const cityListIdStr = session.metadata?.city_list_id
  const hash = session.metadata?.hash

  if (!userIdStr || !cityListIdStr || !hash) {
    console.warn(`[webhook:${config.label}] missing metadata`, {
      hasUserId: !!userIdStr,
      hasCityListId: !!cityListIdStr,
      hasHash: !!hash,
    })
    return Response.json({ received: true })
  }

  const userId = parseInt(userIdStr, 10)
  const cityListId = parseInt(cityListIdStr, 10)

  if (isNaN(userId) || isNaN(cityListId)) {
    console.warn(`[webhook:${config.label}] non-numeric metadata ids`)
    return Response.json({ received: true })
  }

  // Re-resolve via hash to honor soft-delete: even if metadata.user_id is set,
  // a user soft-deleted between checkout and webhook should not receive purchase.
  const { user } = await resolveUserByHash(supabase, hash)
  if (!user || String(user.id) !== userIdStr) {
    return Response.json({ received: true })
  }

  // Look up the city_list to validate the paid amount matches expected price.
  // We know city_list_id from metadata, but the helper queries by city slug —
  // derive city from metadata as defense in depth (so a stale id doesn't get
  // matched to a different active row by accident).
  const cityFromMetadata = session.metadata?.city
  if (!cityFromMetadata) {
    console.warn(`[webhook:${config.label}] missing city in metadata`)
    return Response.json({ received: true })
  }

  // For research SKUs the (city, year, service_tier) constraint allows two
  // rows for SJ 2025. We need to disambiguate by service_tier so list/research
  // don't cross-match. fetchCityList uses .single() which would error on >1
  // row; filter explicitly here.
  const expectedServiceTier =
    config.label === 'research' ? 'research' : 'report'

  const cityList = await fetchCityListByTier(
    supabase,
    cityFromMetadata,
    expectedServiceTier
  )
  if (!cityList || cityList.id !== cityListId) {
    console.warn(`[webhook:${config.label}] city_list mismatch or not found`)
    return Response.json({ received: true })
  }
  if (session.amount_total !== cityList.price_cents) {
    console.warn(`[webhook:${config.label}] amount mismatch`, {
      expected: cityList.price_cents,
      received: session.amount_total,
    })
    return Response.json({ received: true })
  }

  const stripePaymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null

  const insertRow = config.buildInsert({
    userId: user.id,
    cityList,
    session,
    stripePaymentId,
  })

  // Branch on whether a post-insert side effect is configured. The list
  // branch (no side effect) uses the original simple .insert() chain so the
  // existing webhook tests' mock setup remains valid (regression IRON RULE).
  // The research branch (digest subscription side effect) needs the inserted
  // row id, so it uses .insert().select().single() to fetch the row back.
  let insertedRow: Record<string, unknown> | null = null
  let insertError: { code?: string; message?: string } | null = null

  if (config.afterInsert) {
    const { data, error } = await supabase
      .from(config.table)
      .insert(insertRow)
      .select()
      .single()
    insertedRow = data as Record<string, unknown> | null
    insertError = error as { code?: string; message?: string } | null
  } else {
    const { error } = await supabase.from(config.table).insert(insertRow)
    insertError = error as { code?: string; message?: string } | null
  }

  if (insertError) {
    const isDuplicate =
      insertError.code === '23505' ||
      (insertError.message && insertError.message.includes('unique'))
    if (!isDuplicate) {
      return Response.json(
        { error: `Failed to record ${config.label} purchase` },
        { status: 500 }
      )
    }
    // Duplicate → don't run the after-insert side effect (it would double up
    // the digest subscription row).
    return Response.json({ received: true })
  }

  // Run the post-insert side effect if configured. Errors here are logged
  // but do NOT fail the webhook — the purchase record is what matters; the
  // digest subscription can be backfilled manually.
  if (config.afterInsert) {
    try {
      await config.afterInsert({
        supabase,
        userId: user.id,
        cityList,
        insertedRow,
        session,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn(`[webhook:${config.label}] after-insert side effect failed`, {
        message,
      })
    }
  }

  return Response.json({ received: true })
}

/**
 * Internal helper: same shape as fetchCityList but filters on service_tier
 * as well, and uses .single() to match the existing fetchCityList contract.
 *
 * Migration 004 changes UNIQUE(city, year) to UNIQUE(city, year, service_tier),
 * so SJ 2025 has two rows. The webhook needs to pick the right one based on
 * what the customer actually purchased (metadata.product_type). With the
 * service_tier filter applied we still expect 0 or 1 row, so .single() is
 * safe — and the test mocks (which were written against the original
 * fetchCityList .single() pattern) keep working without changes.
 *
 * Returns null on no match (or on any single() error). Caller handles null
 * by returning 200 with a logged warning.
 */
async function fetchCityListByTier(
  supabase: SupabaseClient,
  city: string,
  serviceTier: 'report' | 'research'
): Promise<CityList | null> {
  const { data } = await supabase
    .from('city_lists')
    .select(
      'id, city, year, title, description, headline_insight, headline_insight_subtext, price_cents, anchor_price_cents, active, service_tier, delivery_window_days, created_at, updated_at'
    )
    .eq('city', city)
    .eq('active', true)
    .eq('service_tier', serviceTier)
    .single()

  return (data as CityList | null) ?? null
}

async function handleListPurchase(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  return processCityProductPurchase(session, supabase, {
    label: 'list',
    table: 'list_purchases',
    buildInsert: ({ userId, cityList, session, stripePaymentId }) => ({
      user_id: userId,
      city_list_id: cityList.id,
      stripe_session_id: session.id,
      stripe_payment_id: stripePaymentId,
      amount_cents: session.amount_total,
    }),
  })
}

/**
 * Compute digest_subscription_until: 90 days from purchased_at.
 *
 * Returns an ISO timestamp string. Used both for the research_purchases insert
 * (so the column is populated server-side, never trusting client) and to seed
 * the digest_subscriptions row's effective end date (cron stops sending after
 * this date — even though for v1 there is no cron, the field documents intent).
 */
function ninetyDaysFromNow(): string {
  const ms = Date.now() + 90 * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString()
}

async function handleResearchPurchase(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  return processCityProductPurchase(session, supabase, {
    label: 'research',
    table: 'research_purchases',
    buildInsert: ({ userId, cityList, session, stripePaymentId }) => {
      // Per design Locked Decision #14: instant SKU (delivery_window_days IS
      // NULL) auto-flips to delivered. For v1, only SJ research is shipped
      // (delivery_window_days NULL), so this always lands as 'delivered'.
      // Future cities with non-null delivery_window_days will land as 'pending'.
      const isInstant = cityList.delivery_window_days === null
      const nowIso = new Date().toISOString()

      return {
        user_id: userId,
        city_list_id: cityList.id,
        stripe_session_id: session.id,
        stripe_payment_id: stripePaymentId,
        amount_cents: session.amount_total,
        delivery_status: isInstant ? 'delivered' : 'pending',
        digest_subscription_until: ninetyDaysFromNow(),
        delivered_at: isInstant ? nowIso : null,
      }
    },
    afterInsert: async ({ supabase, cityList, insertedRow }) => {
      // Persist a digest_subscriptions row even for v1 (no Resend wired up
      // yet). This tracks the 90-day window for manual fulfillment by the
      // founder and gives us the unsubscribe_token we'll need when Resend
      // lands. If insertedRow is null (shouldn't happen on a successful
      // insert, but defend), bail without throwing.
      if (!insertedRow || typeof insertedRow.id !== 'number') {
        console.warn('[webhook:research] insertedRow missing id; skipping digest subscription')
        return
      }
      const researchPurchaseId = insertedRow.id
      const { error } = await createDigestSubscription(
        supabase,
        researchPurchaseId,
        cityList.city
      )
      if (error) {
        console.warn('[webhook:research] digest subscription insert failed', {
          message: (error as { message?: string }).message,
        })
      }
    },
  })
}
