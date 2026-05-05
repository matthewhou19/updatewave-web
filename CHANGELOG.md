# Changelog

All notable changes to UpdateWave Web will be documented in this file.

## [0.3.0] — 2026-05-04

### Added
- Email login as a parallel auth path. GCs can now visit `/login`, enter their email, and receive a one-time magic link that takes them straight to their `/browse/[hash]` page. Hash URLs from cold email continue to work indefinitely — email login is purely additive.
- New `/auth/callback` route handler that verifies magic-link tokens via Supabase Auth and resolves the user identity through a 4-case identity model (linked match, stale auth_user_id rotation, first-time link of an existing user by email, brand-new user creation with a fresh URL hash).
- Identity-fork detection: when a brand-new user signs up with an email that resembles an existing paid customer's email (same local-part different domain, or same domain different local-part), an `identity_fork_alerts` row is written for founder review. Catches the "paid as matt@gmail.com, logged in as matt@updatewave.com" case before the user complains.
- `/auth/check-email` confirmation page that renders after submitting the login form.
- Logged-in users can now buy a reveal or city report without the URL hash. `POST /api/create-checkout` and `POST /api/create-list-checkout` accept either `{hash, projectId|city}` (cold-email path) or rely on the cookie session to resolve the user (logged-in path). The hash from the URL still takes precedence when present.
- Tier 1 migration runner script (`scripts/run-tier-1-migration.ts`) for sending activation emails to the ~25 paid customers. Includes `--dry-run` and `--confirm` modes, a hard limit of 50, and pre-flight scans for duplicate emails before the migration runs.
- Database migration 003: adds `users.auth_user_id` (UUID, UNIQUE) for the link to Supabase Auth, a partial UNIQUE constraint on `users.email`, the `identity_fork_alerts` and `auth_login_events` tables, and two RPC functions (`paid_user_ids`, `find_duplicate_emails`) that bypass PostgREST's default 1000-row cap on table scans.
- 30 new tests (4 unit + 6 integration + 5 E2E for the login form and check-email page; auth-resolution covers all 4 identity cases plus soft-delete enforcement, identity-fork detection, and the dual-tab race recovery).

### Changed
- `fetchUserByHash` now filters `deleted_at IS NULL`. Hash URLs for soft-deleted users behave as invalid links instead of resolving to a ghost account on browse/reveals pages. Soft-delete enforcement is now consistent across hash-URL and email-login entry points.
- `getCurrentUser` joins on `auth_user_id` instead of email. After `/auth/callback` runs, `users.auth_user_id` is the canonical link to the cookie session. Existing email-only resolution is no longer used.
- Existing user emails are normalized to lowercase by migration 003 (one-time `UPDATE`), and a new `CHECK (email = lower(email))` constraint enforces the convention going forward. Required because Supabase Auth always lowercases magic-link emails.

### Fixed
- Closes the existing TODO "Soft-Delete on Read Paths — fetchUserByHash". The soft-delete intent from migration 001 is now applied uniformly on read.

## [0.2.0] — 2026-05-04

### Added
- New product line: city market structure reports (the $349 SJ developer-concentration report). GCs can now buy a one-time PDF report at `/list/{hash}/sj` that maps the new-construction market in their city.
- Landing page with preview composition: TOC, one killer insight, three sample data callouts, FAQ, and the buy CTA.
- Post-purchase success page at `/list/{hash}/sj/success` with a re-generatable 2-hour signed download link.
- Stripe Checkout flow for the new product (`POST /api/create-list-checkout`) with idempotency key per (user, city) to prevent duplicate charges from double-clicks.
- Signed-URL download endpoint (`GET /api/download-list/{hash}/{city}`) — the PDF lives in a private Supabase Storage bucket; only paid users get a fresh time-boxed URL.
- Database migration 002: `city_lists` and `list_purchases` tables, RLS policies, the `city-lists-pdfs` Storage bucket, and a seed row for San Jose 2025.
- HTML-to-PDF render script (`scripts/render-report-pdf.ts`) using headless Chromium, so report PDFs are reproducible from source HTML.
- Test hashes documented in README for local dev (`dev-test-001` and the existing seed hashes), with copy-paste SQL to seed.
- 45 new tests (5 unit + 13 integration + 6 E2E + 21 webhook regression cases). Suite total: 64 → 114.

### Changed
- Stripe webhook now dispatches on `metadata.product_type` (`'reveal'` | `'list'`) instead of overloading `client_reference_id`. Existing $25 reveal flow now also tags `metadata.product_type='reveal'`.
- Webhook validates `payment_status === 'paid'` before inserting any record. Async-payment-pending sessions (Cash App, ACH, Klarna) no longer create premature reveal/purchase rows.
- Webhook validates the paid amount matches the expected price for both reveal ($25) and list ($349) flows. Catches Stripe coupon abuse or session-creation bugs that would credit at the wrong price.
- Download API responses now include `Cache-Control: no-store` so the 2-hour signed URL never leaks past its expiry via browser/CDN cache.
- Both reveal and list landing/payment paths now filter `user.deleted_at IS NULL` via the new `resolveUserByHash` helper. A user soft-deleted between checkout and webhook delivery no longer receives a record.

### Fixed
- Pre-existing soft-delete gap in the reveal webhook flow: deleted users could still receive paid reveals because the user lookup didn't honor `deleted_at`.

### Infrastructure
- `.claude/launch.json` committed so any developer can `npm run dev` from their preview tool without local config.
- README "Project Structure" section refreshed to reflect new routes, lib helpers, scripts, and the migrations directory.
- README "Local Test Hashes" section documents the three test hashes and the prerequisites for the `/list` routes (migration 002, Stripe key, PDF upload).

## [0.1.2] — 2026-04-07

### Changed
- Unrevealed project cards now mask the street number (e.g. "802 COLLEEN DR" → "••• COLLEEN DR") so GCs can see the street and neighborhood but must reveal to get the exact address
- Project cards now display the permit description when available, giving GCs more context before they reveal
- Revealed projects now show architect firm and website only (architect name removed from display)
- Project type labels formatted from snake_case to Title Case ("new_construction" → "New Construction")
- Increased checkbox and label touch targets in filter sidebar for better mobile usability

### Added
- Keyboard-accessible focus ring (`:focus-visible`) on all interactive elements
- Unit tests for `formatProjectType` (4 cases) and `maskStreetNumber` (8 cases)

### Fixed
- E2E tests now skip gracefully when seed data is missing instead of failing

## [0.1.1] — 2026-04-07

### Added
- One-command local setup: `npm run setup` runs prerequisites check, env file creation, and dependency install
- Custom 404 page with helpful "check your email" message instead of generic Next.js error
- `npm run stripe:listen` for local webhook testing
- `npm run db:seed` for test data seeding instructions
- MIT LICENSE
- CHANGELOG.md for tracking releases

## [0.1.0] — 2026-04-06

### Added
- Project browse page with city, type, and value filters
- $25/reveal paywall via Stripe Checkout
- Reveals history page at `/reveals/{hash}`
- Public homepage with project listings
- CI/CD pipeline with unit, integration, E2E, and post-deploy smoke tests
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- Supabase RLS policies for data access control
- Stripe webhook handler with idempotent reveal insertion
- Database triggers for atomic reveal_count maintenance
