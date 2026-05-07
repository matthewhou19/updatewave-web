import Stripe from 'stripe'

export function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not set')

  return new Stripe(secretKey)
}

/**
 * Guard for checkout API routes: returns a 503 JSON response if
 * STRIPE_SECRET_KEY is missing (typical for fresh local-dev setups that skip
 * Stripe), otherwise returns null. Caller should `return guard` immediately
 * if non-null.
 *
 * Production deploys always have the key, so this is a no-op there.
 */
export function ensureStripeConfigured(): Response | null {
  if (process.env.STRIPE_SECRET_KEY) return null
  return Response.json(
    {
      error:
        'Payments are not configured in this environment. ' +
        'Set STRIPE_SECRET_KEY (test mode for local dev) and restart the dev server.',
      code: 'stripe_not_configured',
    },
    { status: 503 }
  )
}
