import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createStripeClient } from '@/lib/stripe'
import { resolveUserByHash } from '@/lib/queries'

// Rate limiting: removed non-functional in-memory Map (resets on Vercel cold start,
// not shared across instances). See TODOS.md for Upstash Redis migration plan.

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
    typeof (body as Record<string, unknown>).projectId !== 'number'
  ) {
    return Response.json({ error: 'Missing or invalid fields: hash, projectId' }, { status: 400 })
  }

  const { hash, projectId } = body as { hash: string; projectId: number }

  const supabase = createSupabaseServiceClient()

  // Validate hash -> get user (filters on deleted_at IS NULL)
  const { user, error: userError } = await resolveUserByHash(supabase, hash)

  if (userError || !user) {
    return Response.json({ error: 'Invalid link.' }, { status: 403 })
  }

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
  // Use env-based URL, never trust Origin header (open redirect risk)
  const origin = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Reveal: ${project.address}`,
          },
          unit_amount: 2500,
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
