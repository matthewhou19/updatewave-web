# Deploying updatewave-web to Cloudflare Workers (migration off Vercel)

Status: **feasibility verified, not yet deployed.** This runbook captures the
migration from Vercel to Cloudflare Workers free tier via `@opennextjs/cloudflare`.

## Why this works (verified 2026-06-28)

- `@opennextjs/cloudflare@1.20.1` officially supports Next 16 (`peerDep next: ">=16.2.6"`).
  Repo bumped 16.2.2 → 16.2.9 to enter range.
- OpenNext build succeeds (exit 0) on Next 16.2.9 + React 19.
- `wrangler deploy --dry-run`: **gzip 659.58 KiB** — well under the **3 MB free-tier
  Worker size cap** (Cloudflare measures compressed size). ~5x headroom.
- Per-request **CPU cap on free tier is 10 ms** (I/O wait excluded). The app is
  I/O-bound (Supabase/Stripe), so this should fit — but it is the ONE limit that can
  only be confirmed by deploying and smoking each route (watch for Error 1102).
  Fallback if a route consistently exceeds 10 ms CPU: Workers Paid ($5/mo, 30s CPU).

## Files added for Cloudflare

- `wrangler.jsonc` — Worker config (main `.open-next/worker.js`, `nodejs_compat`,
  `global_fetch_strictly_public`, ASSETS binding, WORKER_SELF_REFERENCE).
- `open-next.config.ts` — minimal (no R2/KV cache → stays on free tier).
- `package.json` scripts: `preview`, `deploy`, `cf-typegen`.
- `.gitignore`: `.open-next/`, `.wrangler/`, `cloudflare-env.d.ts`.

## IMPORTANT: build on Linux

OpenNext warns it is **not fully Windows-compatible** ("could encounter unpredictable
failures during runtime"). The local Windows build worked for sizing, but do the
**production build on Linux** — either Cloudflare's Git integration (recommended) or a
Linux CI runner. Do not deploy a Windows-built bundle to production.

## Deploy path — pick ONE

### Option 1 (RECOMMENDED): Cloudflare Git integration / Workers Builds
Mirrors Vercel's "push → build → deploy". Builds on Cloudflare's Linux runners; no API
token shared with tooling.
1. Cloudflare dashboard → Workers & Pages → Create → connect the GitHub repo.
2. Build command: `npx opennextjs-cloudflare build`
   Deploy command: `npx opennextjs-cloudflare deploy`
   (or set build = `npm run build` style; CF's "Workers Builds" runs deploy after build)
3. Add env vars / secrets (below) in the Worker's Settings.
4. First deploy lands on `https://updatewave-web.<account>.workers.dev` — smoke it.

### Option 2: CLI / CI deploy with an API token
1. Create an API token (My Profile → API Tokens → Create) with:
   - Account · **Workers Scripts** · Edit
   - Account · **Account Settings** · Read
   - Zone · **Workers Routes** · Edit (zone updatewave.org)
   - (DNS · Edit already available)
2. Export `CLOUDFLARE_API_TOKEN` (Workers-scoped) + `CLOUDFLARE_ACCOUNT_ID`.
3. `npm run deploy` (runs `opennextjs-cloudflare build && ... deploy`).
   For CI, do this from a Linux runner; store the token as a GitHub secret.

> The existing `CLOUDFLARE_API_TOKEN` on this machine is **DNS-only** (verified:
> `/accounts` returns count=0). It cannot deploy Workers.

## Environment variables / secrets

Secrets (server-only) — set as Worker secrets (`wrangler secret put` or dashboard):
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Build-time / public vars (inlined at build — must be present when CF builds):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BASE_URL=https://www.updatewave.org`

Setting `NEXT_PUBLIC_BASE_URL` removes any reliance on Vercel's `VERCEL_URL`
fallback in `src/lib/site-url.ts` and `src/app/auth/callback/route.ts`.

## Custom domain cutover (outward-facing — confirm before doing)

updatewave.org is already a Cloudflare zone (`eb7a1aea62d8752983333d7f5eca2a02`).
Currently `www CNAME → cname.vercel-dns.com` (Vercel). To move to the Worker:
1. Deploy + smoke on `*.workers.dev` first.
2. Worker → Settings → Domains & Routes → add **www.updatewave.org** as a custom
   domain. Cloudflare provisions the cert and replaces the DNS record (remove the
   Vercel `www` CNAME).
3. Verify `https://www.updatewave.org` serves the Worker; apex→www redirect still
   handled in `next.config.ts`.

## Stripe webhook

- If the Stripe webhook endpoint already points at `https://www.updatewave.org/api/webhook`,
  it follows the DNS cutover automatically — no Stripe change needed.
- If it points at `*.vercel.app`, update it to the www URL and refresh `STRIPE_WEBHOOK_SECRET`.
- VERIFY a live test payment + webhook delivery end-to-end after cutover.

## Webhook runtime note (test on Workers)

`src/app/api/webhook/route.ts` uses synchronous `stripe.webhooks.constructEvent`.
With `nodejs_compat`, Node `crypto` is polyfilled so it may work — but if signature
verification throws on Workers, switch to `await stripe.webhooks.constructEventAsync(...)`
(works on both Node and Workers). Confirm during smoke.

## Vercel decommission (after cutover verified)

- Remove `VERCEL_URL` fallbacks (`src/lib/site-url.ts`, `src/app/auth/callback/route.ts`).
- `.github/workflows/smoke.yml` triggers on Vercel's `deployment_status` event — replace
  with a post-CF-deploy trigger or `workflow_dispatch`; update the default URL.
- Replace hardcoded `updatewave-web.vercel.app` in `playwright.config.ts`,
  `scripts/run-tier-1-migration.ts`, `README.md`, `CLAUDE.md`.
- Drop `.vercel` ignore + `vercel` CLI perms in `.claude/settings.local.json`.
- Disable the Vercel project's Git integration so it stops auto-deploying `main`.
