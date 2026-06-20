import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createStripeClient, ensureStripeConfigured } from '@/lib/stripe'
import { resolveCheckoutUser } from '@/lib/checkout-auth'
import { resolveBaseUrl } from '@/lib/site-url'

// Rate limiting: removed non-functional in-memory Map (resets on Vercel cold start,
// not shared across instances). See TODOS.md for Upstash Redis migration plan.

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
    typeof (body as Record<string, unknown>).projectId !== 'number'
  ) {
    return Response.json({ error: 'Missing or invalid field: projectId' }, { status: 400 })
  }

  const rawHash = (body as Record<string, unknown>).hash
  const requestedHash = typeof rawHash === 'string' && rawHash.length > 0 ? rawHash : null
  const { projectId } = body as { projectId: number }

  const supabase = createSupabaseServiceClient()

  const authResult = await resolveCheckoutUser(supabase, requestedHash)
  if ('errorResponse' in authResult) {
    return authResult.errorResponse
  }
  const { user, hash } = authResult

  // Validate project exists and is published
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, address, status')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    return Response.json({ error: 'Project not found.' }, { status: 404 })
  }

  if (project.status !== 'published') {
    return Response.json({ error: 'This project is no longer available.' }, { status: 400 })
  }

  // Check if already revealed
  const { data: existingReveal } = await supabase
    .from('reveals')
    .select('id')
    .eq('user_id', user.id)
    .eq('project_id', projectId)
    .single()

  if (existingReveal) {
    return Response.json({ message: 'Already revealed.' }, { status: 200 })
  }

  // Create Stripe Checkout session
  const stripe = createStripeClient()
  // resolveBaseUrl() sanitizes the env value so a malformed NEXT_PUBLIC_BASE_URL
  // can't produce a non-ASCII success_url that Stripe rejects (2026-06-19 outage).
  const origin = resolveBaseUrl()

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Reveal: ${project.address}`,
          },
          unit_amount: 19900,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    client_reference_id: `${hash}:${projectId}`,
    metadata: {
      product_type: 'reveal',
    },
    success_url: `${origin}/browse/${hash}?revealed=${projectId}`,
    cancel_url: `${origin}/browse/${hash}`,
  })

  return Response.json({ url: session.url })
}
