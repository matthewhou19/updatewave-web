# Changelog

All notable changes to UpdateWave Web will be documented in this file.

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
