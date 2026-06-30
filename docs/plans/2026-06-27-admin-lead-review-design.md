# Admin Lead Review Page — Design

**Date:** 2026-06-27
**Status:** Approved (value decisions confirmed with owner), technical details owner-delegated.

## Problem

AI searches new pre-permit leads weekly and writes them to Supabase. Every lead must
pass through the owner's manual review before going live. We need a single private page
where the owner sees each pending lead's full details (including any architectural
drawings) and clicks **Approve** (publish) or **Reject** (archive).

## What the codebase already gives us (no reinvention)

- `projects.status` enum: `'candidate'` (default) → `'published'` / `'archived'`.
  "Approve" = `candidate → published`; "Reject" = `candidate → archived`.
- `projects.reviewed_at` / `published_at` timestamps already exist.
- `project_status_log(project_id, old_status, new_status, changed_by, created_at)` —
  audit table built for exactly this.
- RLS: anon can only read `status='published'`. Candidates are invisible to the public.
  The review page therefore runs server-side with the **service-role** client (the
  pattern every page here uses) and no candidate data ever reaches the browser.
- Magic-link auth (`/login` → `/auth/callback`, cookie session) already works. `next`
  is threaded through the round-trip via `sanitizeNext` / `applyHashToNext`.

## Decisions (value — confirmed with owner)

1. **Gate:** reuse the existing magic-link login, restricted to an email allowlist that
   **defaults in code to the founder email** (so prod needs no env config); `ADMIN_EMAILS`
   env is an optional override. Not a secret URL — identity is bound to the owner's mailbox.
2. **Drawings:** optional per lead. Some leads have them, some don't. Download links
   only — no in-page preview ("download then view").
3. **Actions:** Approve + Reject only. No field editing.

## Architecture

### Route & gate
- New route `/admin/leads` (no hash in URL), `dynamic = 'force-dynamic'`.
- `resolveAdmin(cookieClient)` reads `supabase.auth.getUser()` and checks
  `authUser.email` against the allowlist (defaults to the founder email in code;
  `ADMIN_EMAILS` env overrides, comma-separated, case-insensitive). It does
  **not** depend on the customer `users` table — the owner is not a customer.
  - not logged in → `redirect('/login?next=/admin/leads')`
  - logged in, email not allowlisted → `notFound()` (404 hides the page's existence)
  - allowlisted → render
- **Defense in depth:** the Approve/Reject Server Actions re-run `resolveAdmin`
  themselves. A Server Action is an independently-callable endpoint; the page gate is
  not enough.

### Data
- `fetchCandidateProjects(serviceClient)` — selects the **full** row incl. architect
  fields (admin needs them), `status='candidate'`, `order created_at desc`. Lives in a
  dedicated `src/lib/admin-queries.ts` so it never blurs the defense-in-depth column
  allowlist in `queries.ts` (which deliberately excludes architect fields for public reads).

### Drawings (storage)
- Private Supabase Storage bucket **`lead-drawings`**. Files live under a per-lead
  prefix: `lead-drawings/{project_id}/<filename>`.
- `listDrawings(serviceClient, projectId)`: `.storage.from('lead-drawings').list(id)`,
  filter the `.emptyFolderPlaceholder`, then `createSignedUrls(paths, 1h)`. Returns
  `{ name, url }[]`. Any error (e.g. bucket absent in local dev) → `[]` (graceful: the
  drawings block just doesn't render).
- Chosen over a `drawing_paths` DB column: zero schema migration, naturally handles
  0/1/many files, and the AI writer only has to drop files in the prefix. Cost: one
  storage `.list()` per lead on page load — run in parallel; fine at tens-of-leads scale.

### Actions (Server Actions, `src/app/admin/leads/actions.ts`)
- `approveLead(id)`:
  1. `resolveAdmin` re-check.
  2. `update projects set status='published', published_at=now(), reviewed_at=now()
     where id=:id and status='candidate'` → `.select()` to count affected rows.
     The `status='candidate'` guard makes double-clicks/races idempotent (2nd call hits
     0 rows).
  3. If 1 row changed → insert `project_status_log` (old `candidate`, new `published`,
     `changed_by='admin:<email>'`). If 0 rows → return "already processed", no log.
  4. `revalidatePath('/admin/leads')`.
- `rejectLead(id)`: same shape, `status='archived'`, `reviewed_at=now()` (no
  `published_at`), log new=`archived`.
- Both reversible (status is just a column) and fully audited.

### UI
- One page, newest candidates on top. Header: `待审 N 条 · 今天已处理 M`. Empty state when
  the queue is clear.
- Each lead = a full card: address+city, `CANDIDATE` tag, project type, value,
  filing/intake dates, **architect block** (name/firm/contact/website), description,
  `source_url` + permit id for cross-checking, optional drawings download list, and the
  Approve / Reject buttons.
- `ReviewActions` is a client component (`useTransition`); **Approve** uses a 2-step
  confirm (it publishes live), **Reject** is one click (archived = low-stakes,
  reversible). Action error → inline red text, card stays for retry. Never swallow errors.
- Styling reuses the existing utility-first system (`bg-paper`/`text-ink`/`font-mono`,
  black-bordered cards, `buttonStyles`). No new visuals — honors the anti-AI-slop rule.

### Deliberately out of scope (YAGNI)
Pagination, city grouping, an approved/rejected history view, field editing, bulk
actions. Add later if real volume demands it.

## AI pipeline contract (owner's separate weekly script)

The review page reads whatever the AI writes. The writer must:
1. **Insert** into `projects` with `status` left at its default (`'candidate'`). Required
   columns: `city`, `address` (both NOT NULL). Optional: `project_type`,
   `estimated_value_cents`/`estimated_value`, `description`, `architect_name`,
   `architect_firm`, `architect_contact`, `architect_website`, `filing_date`,
   `source_url`, `source_permit_id`.
2. **Drawings (optional):** after the insert returns the new `id`, upload each drawing
   file to the `lead-drawings` bucket at path `{id}/<filename>`.

**One-time prod setup:** apply migration `008-lead-drawings-bucket.sql` in the Supabase
SQL editor (creates the private `lead-drawings` bucket) — same manual process as
migrations 001-007, a Supabase step, not a hosting-dashboard one. Admin access needs
**no** env config: the allowlist defaults to the founder email and ships with the code.

## Env var (optional)
- `ADMIN_EMAILS` — OPTIONAL comma-separated allowlist override (case-insensitive). Unset =
  defaults to the founder email in code, so prod requires no env configuration. Hosting is
  **Cloudflare Workers (OpenNext)** as of the 2026-06-29 migration; since the deploy ships
  code not env values, defaulting in code means there is nothing host-specific to configure
  for this feature — it is host-agnostic and survived the Vercel→Cloudflare cutover unchanged.

## Files
- `src/lib/admin.ts` — `getAdminEmails`, `isAdminEmail`, `resolveAdmin`.
- `src/lib/admin-queries.ts` — `fetchCandidateProjects`.
- `src/lib/drawings.ts` — `listDrawings` (+ bucket constant).
- `src/app/admin/leads/page.tsx` — gated server page.
- `src/app/admin/leads/actions.ts` — `approveLead` / `rejectLead` Server Actions.
- `src/app/admin/leads/ReviewActions.tsx` — client buttons (confirm + pending + error).
- `supabase/migrations/008-lead-drawings-bucket.sql` — private `lead-drawings` bucket.
- `.env.example` — document the optional `ADMIN_EMAILS` override.
- Tests: `tests/unit/admin.test.ts`, `tests/unit/drawings.test.ts`,
  `tests/integration/admin-actions.test.ts`.

## Verification
`npx tsc --noEmit` · `npm run lint` · `npm run build` · `npm test` · local preview of
`/admin/leads` (gate redirect when logged out; cards + actions when allowlisted).
