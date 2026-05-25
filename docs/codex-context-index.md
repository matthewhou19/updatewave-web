# Codex Context Index

Fast-start context for Codex auto-hook sessions in `updatewave-web`.

## Trust Order

Use the most direct evidence available:

1. Current source code and tests.
2. Actual command output.
3. Current README / manual test docs.
4. Historical docs only as history: `CHANGELOG.md` and `docs/plans/*` may describe old prices or old scope.

Do not treat old roadmap/changelog prices as current product truth.

## Current Product Facts

- Product: UpdateWave Web, a pre-permit lead marketplace for residential GCs.
- Current pricing:
  - Permit lead reveal: `$199`
  - City market structure report: `$499`
  - Custom city research: `$1,999`
- Auth model: hash-in-URL cold-email identity plus Supabase magic-link login.
- Purchases page: `/reveals/[hash]` aggregates reveals, reports, and research.
- Payment stack: Stripe Checkout plus `/api/webhook`.
- Data stack: Supabase Postgres with RLS, service-role server access for protected tables.

## Source Of Truth Map

- Pricing display config: `src/lib/pricing.ts`
- Reveal checkout amount: `src/app/api/create-checkout/route.ts`
- Report checkout amount: `city_lists.price_cents`, read by `src/app/api/create-list-checkout/route.ts`
- Research checkout amount: `city_lists.price_cents`, read by `src/app/api/create-research-checkout/route.ts`
- Webhook validation and product dispatch: `src/app/api/webhook/route.ts`
- Safe public project columns: `PROJECT_LIST_COLUMNS` in `src/lib/queries.ts`
- Safe public city-list columns: `CITY_LIST_PUBLIC_COLUMNS` in `src/lib/queries.ts`
- Auth identity resolution: `src/lib/auth-resolution.ts`
- Cookie-aware auth user lookup: `src/lib/auth.ts` and `src/lib/supabase-server.ts`
- Schema/migrations: `supabase/schema.sql` and `supabase/migrations/*.sql`
- Local seed data: `supabase/seed-test-data.sql`

## Next.js 16 Rule

This repo uses Next.js `16.2.2`, not older App Router assumptions.

Before changing Next.js APIs, read the relevant local docs under:

```text
node_modules/next/dist/docs/
```

Known current patterns:

- `params` and `searchParams` are promises in App Router pages and route handlers.
- `cookies()` and `headers()` are async.
- `next lint` is gone; use ESLint CLI via `npm run lint`.

## Verification Commands

PowerShell may block `npm.ps1`. Prefer `npm.cmd` on Windows:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run lint
```

Known lint caveat: bare `npm.cmd run lint` may scan `.claude/.worktrees/**/.next`
unless ignore rules are tightened. For a source-focused check:

```powershell
npx.cmd eslint src tests scripts --max-warnings=0
```

E2E:

```powershell
npm.cmd run test:e2e
npm.cmd run test:e2e:smoke
```

## Local Test Anchors

Seeded hash:

```text
a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ
```

Important local routes:

- `/browse/[hash]`
- `/reveals/[hash]`
- `/list/[hash]/sj`
- `/list/[hash]/sj/success`
- `/research/[hash]`
- `/research/[hash]/la/status`
- `/login`
- `/auth/callback`

## Security Boundaries

- Never leak architect fields for unrevealed projects.
- Keep `Referrer-Policy: no-referrer`.
- Do not trust `Origin` for success/cancel URLs; use configured base URL.
- Webhook must verify Stripe signature, require paid sessions, validate amount, and stay idempotent.
- `pdf_storage_path` is server-only for download APIs after purchase verification.
- Soft-deleted users must resolve as invalid on both hash and login paths.

## Documentation Traps

- `CHANGELOG.md` is historical. Do not rewrite old entries just because prices changed later.
- `docs/plans/*` are historical plans. They may include outdated price ladders or abandoned scope.
- Current active docs should use `$199`, `$499`, and `$1,999`.
- If product pricing is in doubt, verify against current code and database rows, not memory.

## Git / Workspace Notes

- The repo uses worktrees under `.claude/worktrees/` and `.worktrees/`.
- Do not edit generated `.next`, `playwright-report`, or `test-results` artifacts.
- Stage only files you intentionally changed.
- If Git cannot create `.git/index.lock` due to sandbox permissions, request escalation rather than working around Git.
