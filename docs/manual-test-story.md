# Local Manual Test Story

A complete walkthrough you can run in 10–15 minutes against the local Supabase
stack to confirm the app's three products and dual-mode auth all work end-to-end.

Every step has:
- **Do** — exact action
- **Expect** — what should happen
- **Verify** — how to prove it (URL bar, screenshot region, DB query, etc.)

If a step fails, jump to [Troubleshooting](#troubleshooting) at the bottom.

---

## 0. Pre-flight (1 min)

```bash
# In the project root (or worktree)
npm run supabase:status
```

**Expect** — at least these containers running: `supabase_db`, `supabase_kong`,
`supabase_auth`, `supabase_storage`, `supabase_inbucket`. URLs printed match:

| Service | URL |
|---|---|
| API | `http://127.0.0.1:54321` |
| DB | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Mailpit | `http://127.0.0.1:54324` |

**If anything is "stopped"**, run `npm run supabase:start` and re-check.

```bash
# Confirm seed data is present
docker exec supabase_db_updatewave-web psql -U postgres -d postgres -c \
  "SELECT (SELECT count(*) FROM users) AS users,
          (SELECT count(*) FROM projects) AS projects,
          (SELECT count(*) FROM reveals) AS reveals,
          (SELECT count(*) FROM list_purchases) AS list_p,
          (SELECT count(*) FROM research_purchases) AS research_p;"
```

**Expect** — `2 | 7 | 1 | 1 | 1`. If any are 0, run `npm run db:reset`.

```bash
# Start dev server (foreground in its own terminal)
npm run dev
# → wait for "Ready in ...ms" on http://localhost:3000
```

The seeded test user used throughout is:

```
HASH:  a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ
EMAIL: mike@pacificcoastbuilders.com
```

---

## Story 1 — Cold-email entry: browse → see reveal CTAs (2 min)

Simulates a GC clicking the link in their UpdateWave outreach email.

1. **Do** — open `http://localhost:3000/browse/a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ`
   - **Expect** — TopBar shows "UpdateWave" + "My purchases →". Filters render above
     the list, the count reads "Showing 7 projects", and 7 project cards are visible.
   - **Verify** — count cards in the DOM; each card has city + address +
     project type + filing date + a $199 price block and "Reveal · $199" button.

2. **Do** — open one card that has architect data (e.g. 336 SPRINGER RD).
   - **Expect** — name / firm / email / website are HIDDEN until reveal.
     The button reads "Reveal · $199".
   - **Verify** — view source: architect_* fields are NOT in the rendered HTML
     for unrevealed projects (defense-in-depth check).

3. **Do** — find the already-revealed project card (336 SPRINGER RD belongs to
   the seeded reveal).
   - **Expect** — instead of a Reveal button, the card shows
     "Liu Architecture Studio · jia@liuarch.com · liuarch.com".
   - **Verify** — no $199 CTA; architect contact rendered inline.

---

## Story 2 — My purchases page (3 min)

Verifies the aggregate page from PR #17. This is the highest-leverage smoke
test: it touches all three product tables in one render.

1. **Do** — click "My purchases →" in the TopBar (or open
   `http://localhost:3000/reveals/a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ`).
   - **Expect** — H1 "My purchases". Three sections in this order:

   | Section | Count | Card content | Click target |
   |---|---|---|---|
   | Custom research | 1 | "Los Altos 2025 Custom Market Research" + "In progress" badge + "Purchased May 7, 2026" + "View status →" | `/research/<hash>/la/status` |
   | City reports | 1 | "San Jose 2025 GC Market Structure Report" + "Purchased ..." + "Download report →" | `/list/<hash>/sj/success` |
   | Reveals | 1 | "336 SPRINGER RD" + Liu Architecture Studio + jia@liuarch.com + liuarch.com + "View permit filing ↗" | external permit URL |

2. **Do** — click the research card.
   - **Expect** — lands on `/research/<hash>/la/status`. Status reads
     "In progress" (or matching delivery_status copy). No download link
     because `delivery_status='in_research'`.

3. **Do** — go back, click the City reports card.
   - **Expect** — lands on `/list/<hash>/sj/success`. Page shows
     "Already purchased" copy plus a Download button.
   - **Verify** — clicking Download likely fails locally because the SJ PDF
     was never uploaded to local Supabase Storage (`sj-2025.pdf`). That's
     expected — the success page itself rendering correctly is the test here.
     Skip or upload a placeholder via Studio if you need the download path.

---

## Story 3 — Magic-link login, end-to-end (3 min)

Simulates a returning customer who lost their original cold-email link and
just enters their email.

1. **Do** — clear Mailpit so the new email is the latest one:
   ```bash
   curl -X DELETE 'http://127.0.0.1:54324/api/v1/messages'
   ```

2. **Do** — open `http://localhost:3000/login`.
   - **Expect** — H1 "Log in or sign up", email input, "Send link" button.

3. **Do** — type `mike@pacificcoastbuilders.com`, click "Send link".
   - **Expect** — redirect to `/auth/check-email?email=mike%40...`. No console
     errors.
   - **Verify** — the URL query string contains the URL-encoded email; no
     red error banner.

4. **Do** — open `http://127.0.0.1:54324` (Mailpit web UI).
   - **Expect** — exactly one new email. Subject:
     "Your UpdateWave login link". From: `admin@email.com` (default Supabase
     dev sender — the production stack uses Resend).

5. **Do** — open the email. The body links to
   `http://localhost:3000/auth/callback?token_hash=pkce_...&type=magiclink`.
   - **Expect** — link domain is `localhost:3000`, not `127.0.0.1:54321`.
     If it points at `:54321`, the custom magic-link template is not
     loaded — see [Troubleshooting](#troubleshooting).

6. **Do** — click the magic link in Mailpit.
   - **Expect** — browser navigates through `/auth/callback?...` and lands
     on `/browse/a3jKR9uD6615GnOJQblPtEK4UIAQxpr8vCiPKbe9nHQ`.
   - **Verify** — the URL ends with the seeded hash (proving the email
     resolved to the right `users.id`); a session cookie is set
     (`sb-...-auth-token` in DevTools → Application → Cookies).

7. **Do** — click "My purchases →". Should look identical to Story 2 step 1.

---

## Story 4 — Empty state + invalid hash (2 min)

1. **Do** — open
   `http://localhost:3000/reveals/empty_reveals_test_user_hash_000000000000`.
   - **Expect** — H1 "My purchases" + an empty state region with
     "No purchases yet." + a "Browse available projects →" button.
   - **Verify** — no section headings (Custom research / City reports /
     Reveals) appear; the only content beneath the H1 is the empty-state.
     `data-testid="empty-reveals"` exists.

2. **Do** — open `http://localhost:3000/reveals/totally_invalid_hash_000`.
   - **Expect** — a centered "This link isn't valid. Check your email for
     the correct URL." page with the public TopBar and no purchase sections.

3. **Do** — open `http://localhost:3000/list/a3jKR9uD…/nope`.
   - **Expect** — an error shell saying "This report isn't available right now."

---

## Story 5 — Stripe checkout (optional, ~5 min)

Skip this section if you don't have Stripe test keys. The other stories work
fully without Stripe.

### Setup

1. Add to `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   ```

2. In a new terminal:
   ```bash
   npm run stripe:listen
   ```
   - Copy the printed `whsec_...` into `.env.local` as
     `STRIPE_WEBHOOK_SECRET`. Restart `npm run dev`.

### Reveal flow

1. **Do** — on `/browse/<hash>`, click "Reveal · $199" on any
   un-revealed card. Stripe Checkout opens.

2. **Do** — pay with test card `4242 4242 4242 4242`, any future expiry,
   any CVC, any zip.

3. **Do** — Checkout returns to `/browse/<hash>?revealed=<projectId>`.
   - **Verify** — the card you just revealed now shows architect contact
     inline. The `stripe:listen` terminal logs a `checkout.session.completed`
     event. Confirm a new row appeared:
     ```bash
     docker exec supabase_db_updatewave-web psql -U postgres -d postgres -c \
       "SELECT id, user_id, project_id, amount_cents FROM reveals ORDER BY id DESC LIMIT 3;"
     ```

### City report flow ($499)

1. **Do** — open `/list/<hash>/sj` with a test user that has not already bought
   the SJ report, or seed another report city for this flow. The default Mike
   test user already owns SJ and redirects to `/success`.
2. **Do** — click "Buy report" → Stripe Checkout → test card.
3. **Verify** — landing on `/list/<hash>/sj/success`; new row in
   `list_purchases`.

### Research flow ($1,999)

1. **Do** — open `/research/<hash>`. Pick a city that hasn't been ordered
   yet (LA already has one).
2. **Do** — click "Configure research" → Stripe Checkout → test card.
3. **Verify** — landing on `/research/<hash>/<city>/status`; status reads
   "Pending"; new rows in `research_purchases` AND `digest_subscriptions`.

---

## Story 6 — Reset and start over (30 s)

Anything went sideways or you want a clean slate:

```bash
npm run db:reset    # drops public schema, re-applies schema + migrations + seed
```

The dev server picks up new data on the next request — no restart needed.

---

## Troubleshooting

**Magic link points at `127.0.0.1:54321/auth/v1/verify` instead of
`localhost:3000/auth/callback`** — the custom template isn't loaded. Check
`supabase/config.toml` has the `[auth.email.template.magic_link]` block, then
`npm run supabase:stop && npm run supabase:start && npm run db:reset`.

**`/login` shows "We couldn't send your link right now"** — open DevTools
console. CSP error blocking `127.0.0.1:54321` means `next.config.ts` didn't
pick up `NEXT_PUBLIC_SUPABASE_URL`. Restart `npm run dev`.

**`/reveals/<hash>` says "This link isn't valid" but the user is in `users`
table** — the dev server is pointing at the wrong Supabase. Check
`.env.local` actually contains `http://127.0.0.1:54321` and not a remote URL,
then restart `npm run dev`.

**`permission denied for schema public` from PostgREST** — `db:reset`
forgot to re-grant role privileges. Pull latest, `db:reset` again.

**Port 3000 already in use** — kill the orphan:
```powershell
Get-NetTCPConnection -LocalPort 3000 | Select OwningProcess
Stop-Process -Id <pid> -Force
```

**Mailpit shows the wrong template (no "UpdateWave" branding)** — Supabase
hasn't picked up `supabase/templates/magic-link.html`. Check the file is
referenced in `supabase/config.toml` under `[auth.email.template.magic_link]`,
then `npm run supabase:stop && npm run supabase:start`.

**`docker: command not found` in the shell where you ran `npm run setup`** —
Docker Desktop is installed but not on PATH for that shell. Either restart
the shell after Docker Desktop install, or pass the full path:
`/c/Program\ Files/Docker/Docker/resources/bin/docker.exe info`.

**`supabase start` complains about migration filenames** — known limitation:
this project uses `001-name.sql` instead of Supabase's
`<timestamp>_name.sql` convention. `db.seed` is disabled in `config.toml`
for this reason; `npm run db:reset` does the migration loop manually.
