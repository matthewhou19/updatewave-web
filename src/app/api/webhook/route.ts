import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createStripeClient } from '@/lib/stripe'
import { createSupabaseServiceClient } from '@/lib/supabase'

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
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

    const supabase = createSupabaseServiceClient()

    // Look up user by hash
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('hash', hash)
      .single()

    if (userError || !user) {
      return Response.json({ received: true })
    }

    const amountCents = session.amount_total
    const stripePaymentId = session.payment_intent
      ? typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id
      : null

    // Insert reveal (handle duplicate gracefully via UNIQUE constraint)
    const { error: insertError } = await supabase.from('reveals').insert({
      user_id: user.id,
      project_id: projectId,
      stripe_payment_id: stripePaymentId,
      amount_cents: amountCents,
    })

    if (insertError) {
      // UNIQUE constraint violation = already revealed, that's fine
      const isDuplicate =
        insertError.code === '23505' ||
        (insertError.message && insertError.message.includes('unique'))

      if (!isDuplicate) {
        return Response.json({ error: 'Failed to record reveal' }, { status: 500 })
      }
      // Duplicate: skip reveal_count increment
      return Response.json({ received: true })
    }

    // Increment reveal_count (direct update, no RPC needed)
    const { data: project } = await supabase
      .from('projects')
      .select('reveal_count')
      .eq('id', projectId)
      .single()

    if (project) {
      await supabase
        .from('projects')
        .update({ reveal_count: (project.reveal_count ?? 0) + 1 })
        .eq('id', projectId)
    }
  }

  return Response.json({ received: true })
}
