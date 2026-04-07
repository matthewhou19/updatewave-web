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
