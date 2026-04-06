# UpdateWave Web

Pre-permit lead marketplace for general contractors. GCs browse project listings and pay $25/reveal to see architect contact info.

**Live:** https://updatewave-web.vercel.app

## How It Works

1. GC receives cold email with unique browse link (`/browse/{hash}`)
2. Browses pre-permit project listings with city/type/value filters
3. Pays $25 via Stripe to reveal architect contact info
4. Views all past reveals at `/reveals/{hash}`

No registration. Hash in URL = identity.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Supabase (Postgres + RLS)
- **Payments:** Stripe Checkout + Webhooks
- **Hosting:** Vercel
- **Styling:** Tailwind CSS v4

## Project Structure

```
src/
  app/
    browse/[hash]/page.tsx    # Server component: project list
    reveals/[hash]/page.tsx   # Server component: past reveals
    api/create-checkout/      # Stripe Checkout session
    api/webhook/              # Stripe webhook (idempotent)
  components/
    ProjectList.tsx           # Client: filters + card grid
    ProjectCard.tsx           # Client: reveal button + states
    TopBar.tsx                # Shared nav header
  lib/
    supabase.ts               # Supabase client factories
    stripe.ts                 # Stripe client factory
    types.ts                  # TypeScript interfaces
supabase/
  schema.sql                  # Database schema (tables, indexes, RLS)
  seed-test-data.sql          # Test data for development
```

## Setup

```bash
# Install
npm install

# Configure
cp .env.example .env.local
# Fill in Supabase + Stripe keys

# Run schema
# Paste supabase/schema.sql into Supabase SQL Editor

# Dev
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## Data Pipeline

Data flows one way: `apollo.db → publish_leads.py → Supabase`

Scripts live in the [updatewave](https://github.com/matthewhou19/updatewave) repo:
- `scripts/publish_leads.py` — Push curated leads to Supabase
- `scripts/create_user_hashes.py` — Generate hash URLs for cold email

## Security

- Hash-based auth (no passwords, no sessions)
- `Referrer-Policy: no-referrer` on all pages
- CSP headers restricting to Stripe + Supabase origins
- RLS: anon can only read published projects, service role required for users/reveals
- Webhook signature verification + idempotent reveal insertion
