# UpdateWave Web

Pre-permit lead marketplace for general contractors. GCs browse project listings and pay $25/reveal to see architect contact info, $349 for a city market-structure report, or $1999 for custom city research with a 90-day post-purchase digest.

**Live:** https://updatewave-web.vercel.app

## How It Works

1. GC receives cold email with unique browse link (`/browse/{hash}`)
2. Browses pre-permit project listings with city/type/value filters
3. Pays via Stripe to reveal architect info ($25), buy a city report ($349), or commission custom research ($1999)
4. Views all past purchases at `/reveals/{hash}` ("My purchases" — reveals + reports + research aggregated)

Authentication is dual-mode: hash-in-URL identity (cold-email entry point) plus magic-link email login for returning customers.

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Database:** Supabase (Postgres + RLS)
- **Auth:** Supabase Auth magic-link
- **Payments:** Stripe Checkout + Webhooks
- **Hosting:** Vercel
- **Styling:** Tailwind CSS v4
- **Local dev:** Supabase CLI (Docker)

## Project Structure

```
src/
  app/
    page.tsx                                  # Public homepage: all project listings
    layout.tsx                                # Root layout (referrer-policy meta, fonts)
    not-found.tsx                             # Custom 404 page
    login/                                    # Magic-link login form
    auth/callback/                            # Magic-link callback handler
    browse/[hash]/page.tsx                    # Server component: project list
    reveals/[hash]/page.tsx                   # "My purchases" — reveals + reports + research
    list/[hash]/[city]/                       # $349 city market report
      page.tsx                                # Landing (preview + CTA)
      BuyButton.tsx                           # Client: POSTs /api/create-list-checkout
      success/page.tsx                        # Post-purchase confirmation + download
    research/[hash]/                          # $1999 custom city research
      page.tsx                                # Landing (city dropdown + CTA)
      [city]/status/page.tsx                  # Bookmarkable status + delivered download
    api/create-checkout/                      # Stripe Checkout for $25 reveals
    api/create-list-checkout/                 # Stripe Checkout for $349 reports
    api/create-research-checkout/             # Stripe Checkout for $1999 research
    api/download-list/[hash]/[city]/          # Signed URL for paid report download
    api/download-research/[hash]/[city]/      # Signed URL for delivered research PDF
    api/webhook/                              # Stripe webhook (dispatch on metadata.product_type)
  components/
    ProjectList.tsx                           # Client: filters + card grid
    ProjectCard.tsx                           # Client: reveal button + states
    TopBar.tsx                                # Shared nav header
  lib/
    supabase.ts                               # Supabase client factories
    supabase-server.ts                        # Cookie-aware SSR client (auth)
    stripe.ts                                 # Stripe client factory
    queries.ts                                # DB query helpers
    auth.ts / auth-resolution.ts              # Magic-link auth + identity-fork detection
    safe-next.ts                              # ?next= parameter sanitiser
    format.ts                                 # Date / price formatters
    utils.ts                                  # Shared utilities
    types.ts                                  # TypeScript interfaces
scripts/
  setup-local.sh                              # One-command local dev setup
  db-init.sh                                  # Apply schema + migrations + seed (idempotent)
  db-seed.sh                                  # Re-seed only
  publish_csv.ts                              # CSV → Supabase publish
  render-report-pdf.ts                        # HTML report → PDF (Playwright headless)
  run-tier-1-migration.ts                     # Pre-flight check before migration 005
supabase/
  config.toml                                 # Supabase CLI local stack config
  schema.sql                                  # Base tables (users, projects, reveals, ...)
  seed-test-data.sql                          # Seed for testing
  migrations/
    001-reveal-count-trigger-and-soft-delete.sql
    002-city-lists-and-list-purchases.sql
    003-research-and-digest.sql               # $1999 research + 90-day digest tables
    004-research-tier-uniqueness-fix.sql
    005-email-login-auth.sql                  # auth_user_id + magic-link login
```

## Setup

### Quick Start (recommended)

```bash
npm run setup
```

`scripts/setup-local.sh`:
- Verifies Node + Docker + Stripe CLI
- Copies `.env.example` → `.env.local` (defaults to local Supabase URL + demo keys)
- Installs dependencies
- Starts the local Supabase stack via `npx supabase start` (first run pulls ~10 Docker images)
- Applies `schema.sql` + all migrations + seed via `scripts/db-init.sh`

After it finishes:

```bash
npm run dev
```

Visit `http://localhost:3000/reveals/a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ` to see the "My purchases" page populated with one reveal + one $349 report + one $1999 research-in-progress.

### Manual Setup

```bash
npm install
cp .env.example .env.local           # defaults already point to local Supabase

npx supabase start                   # boots Postgres / Auth / Storage / etc.
npm run db:reset                     # apply schema + migrations + seed (drops existing public)
npm run dev
```

### Switching to remote Supabase

`.env.example` defaults to local. To use a remote Supabase project (staging or prod), overwrite each value in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<remote anon>
SUPABASE_SERVICE_ROLE_KEY=<remote service role>
```

The local-default keys (`...JhbGciOi...exp:1983812996`) are public CLI demo keys — never use them against a real Supabase project.

## Local Test Hashes

`scripts/db-init.sh --drop` (and `npm run setup`) seed two users via `supabase/seed-test-data.sql`:

| Hash | Profile | What it exercises |
|---|---|---|
| `a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ` | Mike Johnson @ Pacific Coast Builders — 1 reveal + 1 SJ report purchase + 1 LA research-in-progress | All three sections of `/reveals/{hash}` |
| `empty_reveals_test_user_hash_000000000000` | Test Empty User — no purchases | Empty-state of `/reveals/{hash}` |

**Test URLs (after `npm run dev`):**

| Route | What it does |
|---|---|
| `/browse/a3jKR9uD…` | Project list with reveal CTA |
| `/reveals/a3jKR9uD…` | "My purchases" — research + reports + reveals |
| `/list/a3jKR9uD…/sj` | $349 SJ report landing |
| `/list/a3jKR9uD…/sj/success` | Post-purchase confirmation + download (already paid) |
| `/research/a3jKR9uD…` | $1999 custom research city dropdown |
| `/research/a3jKR9uD…/la/status` | LA research status (in_research) |
| `/login` | Magic-link login form |
| `/auth/callback` | Magic-link callback (hit by Supabase Auth) |

**Local Stripe checkout flows:**

1. Set `STRIPE_SECRET_KEY` (test mode) in `.env.local`
2. Run `npm run stripe:listen` in another terminal — copy the printed `STRIPE_WEBHOOK_SECRET` into `.env.local`
3. Click any "Reveal" / "Buy" / "Order research" button — Stripe Checkout uses test card `4242 4242 4242 4242`

**Local magic-link login:**

The local Supabase CLI ships with [Mailpit](http://127.0.0.1:54324) — every auth email is captured there instead of being delivered. After you submit `/login`, open Mailpit and click the link.

## Testing

```bash
npm test              # Unit + integration tests (Vitest)
npm run test:watch    # Watch mode
npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm run test:e2e      # E2E tests (Playwright — needs dev server)
npm run test:e2e:smoke # Post-deploy smoke tests against production
```

### Stripe & Database helpers

```bash
npm run stripe:listen      # Forward Stripe webhooks to localhost
npm run supabase:start     # Boot local Postgres / Auth / Storage / Mailpit
npm run supabase:stop      # Stop the local stack
npm run supabase:status    # Show URLs + keys
npm run db:reset           # Drop + reapply schema, migrations, seed
npm run db:init            # Apply schema, migrations, seed (no drop — idempotent)
npm run db:seed            # Re-apply seed-test-data.sql only
```

## Worktree Notes

This repo uses git worktrees for parallel feature branches (see `.claude/worktrees/` and `.worktrees/`). When working in a fresh worktree:

1. **`npm install`** — `node_modules` is gitignored, so each worktree needs its own install. Or symlink/copy from the main repo.
2. **`.env.local`** is gitignored too — copy from the main repo or re-run `cp .env.example .env.local`.
3. **The local Supabase stack is shared across all worktrees** (one Docker stack per project). You don't run `supabase start` per worktree.

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

- Hash-based auth (no passwords for cold-email entry); magic-link email login for returning users
- `Referrer-Policy: no-referrer` on all pages
- CSP headers restricting to Stripe + Supabase origins
- RLS: anon can only read published projects, service role required for users/reveals/purchases
- Webhook signature verification + idempotent reveal/purchase insertion via UNIQUE constraints
