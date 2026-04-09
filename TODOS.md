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

## E2E Test Selector Migration — data-testid
- **What:** Migrate existing E2E selectors from CSS class matching (`[class*="bg-white rounded-lg"]`) to `data-testid` attributes across `browse.spec.ts`, `reveal.spec.ts`, and `filters.spec.ts`.
- **Why:** CSS selectors break when styling changes (dark mode, Tailwind version bump, design polish). `data-testid` is behavior-stable. New tests already use `data-testid`, creating a split in selector strategies that confuses future test authors.
- **Pros:** All tests use one selector strategy. Styling changes never break tests. Cleaner test code.
- **Cons:** Requires adding `data-testid` to more components (ProjectCard on browse page, filter elements). ~20 min of work.
- **Context:** New tests from the test gap close plan (2026-04-07) use `data-testid` exclusively. Existing tests still use `[class*=...]`. The split is manageable now (4 files) but will compound with each new test file.
- **Trigger:** Next time E2E tests touch `browse.spec.ts` or `filters.spec.ts`.
- **Depends on:** data-testid attributes from the test gap close plan must land first.
