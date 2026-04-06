@AGENTS.md

# UpdateWave Web — Pre-Permit Lead Marketplace

Next.js 16 + Supabase + Stripe. GCs browse pre-permit project listings and pay $25/reveal to see architect contact info.

## Architecture
- `/browse/[hash]` — main browsing page (server component + client filter component)
- `/reveals/[hash]` — past reveals page (server component)
- `/api/create-checkout` — Stripe Checkout session creation
- `/api/webhook` — Stripe webhook handler

## Key Rules
- Hash in URL = user identity. Never log hashes to external services.
- `<meta name="referrer" content="no-referrer">` on all pages.
- Webhook handler must be idempotent (UNIQUE constraint on reveals).
- No dark mode. No decorative elements. Utility-first design.

## Environment
Copy `.env.example` to `.env.local` and fill in values.

## Commands
- `npm run dev` — local development
- `npm run build` — production build
- `npm run lint` — ESLint check
