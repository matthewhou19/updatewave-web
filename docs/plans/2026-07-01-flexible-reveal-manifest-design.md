# Flexible Reveal Manifest — Design (2026-07-01)

## Problem

The `/browse` lead card shows a masked street number but dumps the full
`description` — including inline `Owner: Name (email, phone)` — for free, while a
$199 reveal only delivers **architect** contact. Buyers can't tell, before
paying, what a given lead actually contains, and owner contact leaks pre-payment.

## Decisions (locked with the user)

1. **Deliverables:** a reveal unlocks **all info except `source_url`** (source is
   never sent, even post-reveal). Flexible per lead — leads carry different
   subsets of {owner contact, architect contact, drawings}. Future: per-lead
   pricing (not built now; keep price a single source so it's a one-line change).
2. **Pre-reveal preview:** a **checklist manifest** — list *what* you'll unlock,
   never the values.
3. Ship the checklist approach ("A") first; blurred/redacted teasers are a
   possible later phase.

## Approach — no schema migration (phase 1)

Everything is computable from existing data + the `lead-drawings` bucket, all
server-side on the browse page (which already uses the service-role client):

| Manifest item | Source of presence (pre-reveal, no value leaked) | Delivery (revealed only) |
|---|---|---|
| Exact street address | always present | full `address` (already implemented) |
| Property owner contact | `stripOwnerContact(description)` → boolean | inline in raw `description` |
| Architect / designer contact | `id`-only presence query (`architect_contact` not null) | `fetchArchitectData` (already implemented) |
| Architectural drawings | `lead-drawings` bucket root listing → id set | `listDrawings` signed URLs, revealed ids only |

- **Owner** lives only in `description` free text (no column upstream). A pure
  `stripOwnerContact()` removes the `Owner: … (…)` clause for the pre-reveal
  description and, as a safety net, redacts any residual email/phone — a testable
  invariant: *pre-reveal description contains no email or phone*. Post-reveal we
  show the raw description (owner inline).
- **`source_url`** is dropped from `PROJECT_LIST_COLUMNS` so it never reaches the
  client.
- No new columns, no backfill, no pipeline change. The web layer sanitizes what
  the pipeline writes, so it's robust even if `publish_leads` keeps embedding
  owner in the description.

## Data flow (browse page, server component)

```
fetchPublishedProjects        → projects (no architect/owner values, no source_url)
fetchUserReveals              → revealedProjectIds
fetchArchitectData(revealed) → architect values for revealed ids
fetchArchitectPresenceIds    → published ids that have architect info
fetchDrawingProjectIds       → published ids that have ≥1 drawing (1 storage call)
fetchDrawingsForProjects(revealed) → signed drawing URLs for revealed ids
assembleBrowseProjects(...)  → BrowseProject[] (pure, unit-tested)
```

`assembleBrowseProjects` per project: pick raw-vs-sanitized description by
reveal state, set `has_owner_contact / has_architect_contact / has_drawings`,
merge architect values + drawings for revealed ids only.

## Files

- `src/lib/owner.ts` (new) — `stripOwnerContact` pure fn
- `src/lib/browse.ts` (new) — `assembleBrowseProjects` + `BrowseProject`
- `src/lib/drawings.ts` — `fetchDrawingProjectIds`, `fetchDrawingsForProjects`
- `src/lib/queries.ts` — drop `source_url`; add `fetchArchitectPresenceIds`
- `src/app/browse/[hash]/page.tsx` — wire assembly
- `src/components/ProjectCard.tsx` — pre-reveal manifest, post-reveal drawings
  section, banner copy ("Lead unlocked")
- `src/components/ProjectList.tsx` — thread manifest props
- tests: `owner.test.ts`, `browse.test.ts`, extend `queries.test.ts`,
  `drawings.test.ts`

## Security invariants (unit-tested)

- Pre-reveal client payload carries **no** owner email/phone, **no** architect
  values, **no** `source_url`.
- Architect values + drawing signed URLs are fetched **only** for revealed ids.

## Out of scope / follow-ups

- Populate structured `owner_*` columns in the lead-publish pipeline (updatewave
  repo) and drop the runtime sanitizer once upstream is clean.
- Per-lead reveal pricing (`reveal_price_cents`).
- Surface `last_action_summary` (hearing status) as a manifest item.
- Blurred/redacted teaser previews ("B").
- `/reveals/[hash]` page: confirm `source_url` isn't shown there either.
- Drawing count in the manifest (currently presence-only; root listing capped at
  100 folders — fine at current scale).
