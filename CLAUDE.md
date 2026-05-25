@AGENTS.md

# UpdateWave Web — Pre-Permit Lead Marketplace

Next.js 16 + Supabase + Stripe. GCs browse pre-permit project listings and pay $199/reveal to see architect contact info, $499 for the SJ city report, or $1,999 for custom city research.

**Live:** https://updatewave-web.vercel.app
**Supabase:** project ref `gucsgfpiruhjsmzwcnqp`
**Stripe:** test mode, webhook at `/api/webhook`

## Architecture
- `/browse/[hash]` — main browsing page (server component + client filter component)
- `/reveals/[hash]` — aggregated purchases page (reveals + reports + research)
- `/list/[hash]/[city]` — $499 city report landing + success/download flow
- `/research/[hash]` — $1,999 custom city research landing + status/download flow
- `/api/create-checkout` — Stripe Checkout session creation (no rate limiting; see TODOS.md)
- `/api/create-list-checkout` — Stripe Checkout session creation for city reports
- `/api/create-research-checkout` — Stripe Checkout session creation for custom research
- `/api/webhook` — Stripe webhook handler (idempotent via UNIQUE constraint)

## Database
Core tables in Supabase: `projects`, `users`, `reveals`, `city_lists`, `list_purchases`,
`research_purchases`, `digest_subscriptions`, `delivery_events`, `identity_fork_alerts`,
`auth_login_events`, `project_status_log`
- RLS enabled: anon reads published projects only, service role for everything else
- `reveals` has UNIQUE(user_id, project_id) for idempotency
- `list_purchases` and `research_purchases` have UNIQUE(user_id, city_list_id) for idempotency
- `projects.updated_at` auto-updated via trigger

## Data Flow
One-way: `apollo.db → publish_leads.py → Supabase projects table`
- Scripts in updatewave repo: `scripts/publish_leads.py`, `scripts/create_user_hashes.py`
- Never sync backward from Supabase to apollo.db

## Key Rules
- Hash in URL = user identity. Never log hashes to external services.
- `<meta name="referrer" content="no-referrer">` on all pages.
- Webhook handler must be idempotent (UNIQUE constraint on reveals).
- No dark mode. No decorative elements. Utility-first design.
- Anti-AI-slop: no purple gradients, no 3-column grids, no icons-in-circles.

## Environment
Copy `.env.example` to `.env.local` and fill in values.
Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET

## Commands
- `npm run dev` — local development
- `npm run build` — production build
- `npm run lint` — ESLint check
- `npm test` — unit + integration tests (Vitest)
- `npm run test:watch` — tests in watch mode
- `npm run test:e2e` — E2E tests (Playwright, needs running dev server)
- `npm run test:e2e:smoke` — post-deploy smoke tests against production
- `npm run setup` — one-command local dev setup
- `npm run stripe:listen` — forward Stripe webhooks to localhost
- `npm run db:seed` — seed test data instructions

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
