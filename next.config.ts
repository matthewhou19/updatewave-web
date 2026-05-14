import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'

// In dev, allow the browser to talk to local Supabase (default port 54321)
// and any other localhost service. Production stays strict — only the cloud
// Supabase project + Stripe.
const devConnectSources = isDev ? ' http://127.0.0.1:* http://localhost:*' : ''

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      `connect-src 'self' https://*.supabase.co https://api.stripe.com${devConnectSources}`,
      "frame-src https://js.stripe.com https://hooks.stripe.com",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
