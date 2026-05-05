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
    page.tsx                          # Public homepage: all project listings
    layout.tsx                        # Root layout (referrer-policy meta, fonts)
    not-found.tsx                     # Custom 404 page
    browse/[hash]/page.tsx            # Server component: project list
    reveals/[hash]/page.tsx           # Server component: past reveals
    list/[hash]/[city]/
      page.tsx                        # City market report landing (preview + CTA)
      BuyButton.tsx                   # Client: POSTs /api/create-list-checkout
      success/
        page.tsx                      # Post-purchase confirmation + download
        DownloadButton.tsx            # Client: fetches signed Storage URL
    api/create-checkout/              # Stripe Checkout for $25 reveals
    api/create-list-checkout/         # Stripe Checkout for $349 city reports
    api/download-list/[hash]/[city]/  # Signed URL for paid PDF download (2h TTL)
    api/webhook/                      # Stripe webhook (dispatches on metadata.product_type)
  components/
    ProjectList.tsx                   # Client: filters + card grid
    ProjectCard.tsx                   # Client: reveal button + states
    TopBar.tsx                        # Shared nav header
  lib/
    supabase.ts                       # Supabase client factories
    stripe.ts                         # Stripe client factory
    queries.ts                        # DB query helpers (resolveUserByHash, fetchCityList, ...)
    format.ts                         # Date / price formatters
    utils.ts                          # Shared utilities
    types.ts                          # TypeScript interfaces
scripts/
  setup-local.sh                      # One-command local dev setup
  publish_csv.ts                      # CSV → Supabase publish
  render-report-pdf.ts                # HTML report → PDF (Playwright headless)
supabase/
  schema.sql                          # Database schema (tables, indexes, RLS)
  seed-test-data.sql                  # Test data for development
  migrations/
    001-reveal-count-trigger-and-soft-delete.sql
    002-city-lists-and-list-purchases.sql
```

## Setup

### Quick Start (recommended)

```bash
npm run setup
```

This runs `scripts/setup-local.sh`, which checks prerequisites, copies `.env.example` to `.env.local`, installs dependencies, and prints next steps.

### Manual Setup

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

## Local Test Hashes

Pre-defined hashes for local development. Hash in URL = user identity, so
hitting any `/browse/{hash}` or `/list/{hash}/{city}` route in the browser
needs a row in the `users` table.

| Hash | Profile | What it exercises |
|---|---|---|
| `dev-test-001` | Generic dev user | Any route: browse, reveals, list landing |
| `test_abcdefghijklmnopqrstuvwxyz1234567890A` | Mike Johnson @ Pacific Coast Builders, has reveals | Reveals page with data |
| `empty_reveals_test_user_hash_000000000000` | Test Empty User, no reveals | Empty-state of reveals page |

**Seed:**

```sql
-- The two test_/empty_ hashes are in supabase/seed-test-data.sql.
-- For dev-test-001, run this once in Supabase SQL Editor:
INSERT INTO users (hash, name, company, email, source_campaign)
VALUES ('dev-test-001', 'Dev Test', 'Test GC', 'dev@example.com', 'local-dev')
ON CONFLICT (hash) DO NOTHING;
```

**Test URLs (after `npm run dev`):**

- Browse: `http://localhost:3000/browse/dev-test-001`
- Reveals: `http://localhost:3000/reveals/dev-test-001`
- City list landing (SJ): `http://localhost:3000/list/dev-test-001/sj`
- City list success: `http://localhost:3000/list/dev-test-001/sj/success`
- Email login form: `http://localhost:3000/login`
- Magic-link callback (hit by Supabase Auth): `http://localhost:3000/auth/callback`

**Prerequisites for the `/list` routes:**

1. Migration `supabase/migrations/002-city-lists-and-list-purchases.sql` applied (creates `city_lists` + `list_purchases` tables and seeds the SJ row).
2. `STRIPE_SECRET_KEY` set in `.env.local` (Buy button calls Stripe Checkout).
3. PDF uploaded to Supabase Storage at `city-lists-pdfs/sj-2025.pdf` (Download button needs the file to exist).

**Prerequisites for the email login flow (`/login` + `/auth/callback`):**

1. Migration `supabase/migrations/003-email-login-auth.sql` applied (adds `users.auth_user_id`, partial UNIQUE on email, `identity_fork_alerts` and `auth_login_events` tables, `paid_user_ids()` and `find_duplicate_emails()` RPCs).
2. Supabase Auth SMTP configured to send via Resend from `auth.updatewave.com` (DNS: SPF, DKIM, DMARC).
3. Redirect URL allowlist in Supabase Auth includes `http://localhost:3000/auth/callback` for local dev and `https://updatewave-web.vercel.app/auth/callback` for production.

## Testing

```bash
npm test              # Unit tests (Vitest)
npm run test:watch    # Unit tests in watch mode
npm run test:e2e      # E2E tests (Playwright)
npm run test:e2e:smoke # Post-deploy smoke tests
```

### Stripe & Database helpers

```bash
npm run stripe:listen  # Forward Stripe webhooks to localhost
npm run db:seed        # Instructions for seeding test data
```

## Data Pipeline

Data flows one way: `apollo.db → publish_leads.py → Supabase`

Scripts live in the [updatewave](https://github.com/matthewhou19/updatewave) repo:
- `scripts/publish_leads.py` — Push curated leads to Supabase
- `scripts/create_user_hashes.py` — Generate hash URLs for cold email

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT — see [LICENSE](LICENSE).

## Security

- Hash-based auth (no passwords, no sessions)
- `Referrer-Policy: no-referrer` on all pages
- CSP headers restricting to Stripe + Supabase origins
- RLS: anon can only read published projects, service role required for users/reveals
- Webhook signature verification + idempotent reveal insertion
