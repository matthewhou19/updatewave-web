import type { NextConfig } from 'next'

// Derive the Supabase origin from env so CSP allows the active project
// (works for both local stack at http://127.0.0.1:54321 and remote
// https://*.supabase.co). Falls back to the wildcard for the remote
// production deployment when the env var is unset at build time.
const supabaseOrigin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return 'https://*.supabase.co'
  try {
    return new URL(url).origin
  } catch {
    return 'https://*.supabase.co'
  }
})()

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
      `connect-src 'self' ${supabaseOrigin} https://*.supabase.co https://api.stripe.com`,
      "frame-src https://js.stripe.com https://hooks.stripe.com",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  // Pin Turbopack root to this config's directory. Without it, Next.js
  // walks upward looking for a lockfile and silently picks the parent
  // repo's lockfile when this project is checked out as a git worktree
  // (see README "Worktree Notes"), serving the wrong source tree.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  // NOTE: the apex updatewave.org → www redirect that used to live here was
  // removed during the Cloudflare migration. Next's `redirects()` with a
  // `:path*` param does NOT work under @opennextjs/cloudflare — the param is
  // not substituted (Location becomes the literal `/:path*`) and the host
  // condition matched www too, producing an infinite 308 loop on the worker.
  // apex → www is handled at the Cloudflare edge (a redirect rule) instead.
}

export default nextConfig
