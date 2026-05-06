# TODOS

## Rate Limiting — Upstash Redis
- **What:** Replace removed in-memory rate limiter with Upstash Redis + @upstash/ratelimit on /api/create-checkout
- **Why:** Without rate limiting, anyone can spam checkout session creation. In-memory Map was removed because it doesn't work on Vercel serverless (resets on cold start, not shared across instances).
- **Pros:** Real protection against abuse. Upstash free tier handles 10K requests/day.
- **Cons:** Adds a dependency (Upstash account + Redis instance). ~$0/month on free tier.
- **Context:** The old rate limiter at create-checkout/route.ts used a module-scope Map with 5 req/min limit. It was non-functional on Vercel. Removed during CI/CD plan implementation. Standard solution: `@upstash/ratelimit` with sliding window algorithm.
- **Trigger:** Before marketing push or >10 active users.
- **Depends on:** Nothing. Independent workstream.

## Error Monitoring — Sentry
- **What:** Add Sentry (or Vercel error monitoring) for production error tracking.
- **Why:** No visibility into production errors. If webhook fails at 2am, nobody knows until a customer complains. With $25/reveal revenue, even one lost payment justifies monitoring.
- **Pros:** Immediate alerts on errors, stack traces, error grouping, performance monitoring.
- **Cons:** Adds SDK dependency. Free tier: 5K errors/month (more than enough).
- **Context:** Currently zero error monitoring. Post-deploy smoke tests (Layer 3) catch "site is down" but not runtime errors or degraded behavior. Sentry Next.js SDK is a 5-minute install.
- **Trigger:** Before next customer onboarding.
- **Depends on:** Nothing. Independent workstream.

## Branch Protection
- **What:** Enable branch protection on main: require CI status checks to pass before merge.
- **Why:** Currently any push to main auto-deploys to production via Vercel. Without branch protection, CI is informational only. Broken code can still reach production.
- **Pros:** Guarantees CI passes before production deploy. Safety net for the money path.
- **Cons:** Slightly slower workflow (must wait for CI). Solo founder overhead is minimal.
- **Context:** GitHub repo settings change, not code. One checkbox. Do after CI workflow is verified working for at least 1 week.
- **Trigger:** CI pipeline is now stable and verified (full green run 2026-04-06: 64 unit + 12 E2E + 3 smoke tests passing). Ready to enable.
- **Depends on:** CI/CD pipeline (this plan) must be working first. ✅ Done.

## Pagination
- **What:** Add LIMIT/OFFSET or cursor-based pagination to project queries on browse pages.
- **Why:** page.tsx and browse/[hash]/page.tsx fetch ALL published projects with no LIMIT. With 8 projects today, this is fine. At 100+ projects, page loads will slow.
- **Pros:** Consistent page load times regardless of project count. Better UX at scale.
- **Cons:** More complex queries, pagination UI, filter interaction complexity.
- **Context:** Both pages use `select('*').eq('status', 'published').order('filing_date', ...)` with no limit. Supabase handles hundreds of rows in single-digit ms, so this is not urgent.
- **Trigger:** When project count exceeds 100.
- **Depends on:** Nothing. Independent workstream.

## Design Polish — Deferred from 2026-04-07 Audit

Design audit scored the site B- → B+ after fixing all 4 high-impact findings. These 5 remain:

### Skip-Navigation Link (FINDING-005, medium, a11y)
- **What:** Add a hidden "Skip to main content" link as the first focusable element on every page.
- **Why:** Screen reader and keyboard-only users currently have to tab through TopBar and filters to reach project cards. WCAG 2.4.1 requires a skip mechanism.
- **Effort:** Small. One component added to layout.tsx.

### Filter Checkbox Touch Targets (FINDING-006, medium, interaction)
- **What:** Increase filter checkbox label height to 44px minimum on mobile.
- **Why:** Current `py-1` labels are ~32px. On mobile, users will mis-tap adjacent filters. WCAG 2.5.8 target size.
- **Effort:** Small. Change `py-1` to `py-2` on checkbox labels in ProjectList.tsx.

### Unused CSS Custom Properties (FINDING-008, polish, color)
- **What:** Remove unused `--background`, `--foreground` etc. CSS variables from globals.css, or adopt them in Tailwind config.
- **Why:** Dead code. Defined but never referenced. Confusing for anyone reading the stylesheet.
- **Effort:** Trivial. Delete or wire up.

### Duplicate Font Family Declaration (FINDING-009, polish, typography)
- **What:** Font family is set in both globals.css `body {}` and Tailwind's `theme.fontFamily`. Pick one.
- **Why:** Redundant. If Tailwind config changes, the CSS override will mask it silently.
- **Effort:** Trivial. Remove one declaration.

### Arbitrary Font Sizes (FINDING-010, polish, typography)
- **What:** Replace `text-[16px]` with Tailwind's `text-base` (which is 16px/1rem).
- **Why:** Arbitrary values bypass the type scale and make future changes harder. `text-base` is semantically equivalent.
- **Effort:** Trivial. Find-and-replace in ProjectCard.tsx and reveals page.

### Reveal Button Missing Accessible Context (subagent finding, high, a11y)
- **What:** Add `aria-describedby` on the Reveal button linking it to the blurred placeholder, so screen readers announce WHAT is being revealed, not just "Reveal · $25".
- **Where:** `ProjectCard.tsx:127-133`. The adjacent blur div already has `aria-label="Architect details hidden"` but is not linked.
- **Effort:** Small. Add an `id` to the blur div and `aria-describedby` to the button.

### Links Lack Non-Color Distinction (subagent finding, high, a11y)
- **What:** Architect website links rely solely on blue color to distinguish from surrounding text. WCAG 1.4.1 requires a non-color indicator (underline, bold, icon).
- **Where:** `ProjectCard.tsx:105-112`, `reveals/[hash]/page.tsx:162-169`.
- **Effort:** Small. Add `underline` or `hover:underline` class to link elements.

## Email Change UI — Self-Serve
- **What:** `/account` page that lets a logged-in user change their email. Sends magic link to the new email; only swaps `users.email` after the new address is verified.
- **Why:** v1 of email login auth (this design) defers email change to founder-manual SQL update. As the user base grows, founder gets requests like "I changed jobs, my work email is X now". Manual SQL becomes a chore + risks incorrect updates.
- **Pros:** User self-service. Removes a class of founder support tickets.
- **Cons:** Adds a 2-email transition state (old email + pending new email), validation flow, edge cases (cancel pending, resend). Probably 4-6h CC time.
- **Context:** Email login auth design (2026-05-04) explicitly defers this. The `users.email` column has UNIQUE constraint after migration 003, so collision handling is required in the swap code.
- **Trigger:** First time founder gets a "please update my email" request, OR v1 14-day metric reaches the subscription product threshold (≥ 5 unique activations in 14 days).
- **Depends on:** Email login auth (v0.3.0) — landed.

## Subscription Billing Portal Integration
- **What:** Wire Stripe Customer Portal into the app so subscribed users can view invoices, upgrade plans, cancel subscriptions self-serve.
- **Why:** The email login auth design (2026-05-04) builds the auth foundation for subscription products, but no actual subscription product exists yet. When the first one launches, billing portal is needed.
- **Pros:** Standard Stripe-hosted UI, minimal custom code. Supports invoice history, payment method updates, cancellation.
- **Cons:** Requires a subscription product designed first (price, term, product name, what gets gated). Cannot be built standalone.
- **Context:** Stripe Customer Portal is configured per-customer via `stripe.billingPortal.sessions.create({ customer: stripe_customer_id })`. The link is short-lived. Need to map `users.id` to `stripe.customers.id` (new column or lookup via past payment intents).
- **Trigger:** First customer asks "I want to subscribe annually" — that's the v1 14-day metric trigger. Until then, building this is speculative.
- **Depends on:** Email login auth foundation (v0.3.0) — landed. Plus a designed subscription product.

## Identity-Fork Manual Merge UI
- **What:** Admin page for founder to review `identity_fork_alerts` entries (created when a new login email looks suspiciously similar to an existing paid user). Selecting "merge X into Y" runs a transaction: UPDATE reveals/list_purchases user_id from X to Y, soft-delete X, mark alert reviewed.
- **Why:** The email login auth design writes alert rows but provides no UI to act on them. Without a UI, alerts pile up and forks are never merged.
- **Pros:** Founder doesn't need to write transactional SQL by hand. Audit trail (`identity_fork_alerts.reviewed_at`) is set automatically.
- **Cons:** Admin page needs its own auth (role check on Supabase Auth user, or restrict to founder's email). Code complexity for transactional merge isn't trivial. Probably 3-4h CC time.
- **Context:** Migration 003 creates `identity_fork_alerts` with `(user_id_new, user_id_likely_old, similarity_signal, created_at, reviewed_at)`. SQL queries can do the inspection today. The merge transaction is the only meaningful new code.
- **Trigger:** First identity_fork_alerts row with a real fork (not a false positive). Until then, founder reviews via SQL.
- **Depends on:** Email login auth (v0.3.0) — landed. Plus admin auth pattern decision.

## Lost Hash + Lost Email Recovery — Admin Lookup
- **What:** Admin page where founder searches users by name/company/phone and re-issues a hash URL to a known-good email or resets the user's email so they can log in.
- **Why:** v1 of the email login auth design has no recovery path for users who lost both their hash URL AND access to their original email. Founder runs SQL today.
- **Pros:** Reduces founder SQL labor for an edge-case-but-real recovery scenario.
- **Cons:** Admin page needs auth. Most data fields needed for lookup (name, company) are stored on `users` already, so the SQL query is short. UI is overhead.
- **Context:** Edge case. Probably happens < 5 times/year at current scale. SQL fallback is acceptable for a long time.
- **Trigger:** First time a user emails support saying "I lost my link AND my old email is gone". Until then, founder handles ad-hoc.
- **Depends on:** Identity-fork merge UI (above) probably should share the admin auth pattern.

## E2E Test Selector Migration — data-testid
- **What:** Migrate existing E2E selectors from CSS class matching (`[class*="bg-white rounded-lg"]`) to `data-testid` attributes across `browse.spec.ts`, `reveal.spec.ts`, and `filters.spec.ts`.
- **Why:** CSS selectors break when styling changes (dark mode, Tailwind version bump, design polish). `data-testid` is behavior-stable. New tests already use `data-testid`, creating a split in selector strategies that confuses future test authors.
- **Pros:** All tests use one selector strategy. Styling changes never break tests. Cleaner test code.
- **Cons:** Requires adding `data-testid` to more components (ProjectCard on browse page, filter elements). ~20 min of work.
- **Context:** New tests from the test gap close plan (2026-04-07) use `data-testid` exclusively. Existing tests still use `[class*=...]`. The split is manageable now (4 files) but will compound with each new test file.
- **Trigger:** Next time E2E tests touch `browse.spec.ts` or `filters.spec.ts`.
- **Depends on:** data-testid attributes from the test gap close plan must land first.

## Completed

### Soft-Delete on Read Paths — fetchUserByHash
- **What was done:** Added `.is('deleted_at', null)` filter to `fetchUserByHash` in `src/lib/queries.ts`. Switched from `.single()` to `.maybeSingle()` for cleaner null-vs-error handling. Added 2 regression tests in `tests/unit/queries.test.ts`. Hash URLs for soft-deleted users now behave as invalid across browse/reveals/list pages, matching the magic-link path's behavior.
- **Completed:** v0.3.0 (2026-05-04) — bundled with the email-login auth PR.
