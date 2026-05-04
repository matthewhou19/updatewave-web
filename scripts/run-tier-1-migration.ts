/**
 * Tier 1 email-login migration runner.
 *
 * Sends "set up email login" emails to paid customers (~25 users with at least
 * one row in `reveals` or `list_purchases`). Designed for one-shot manual use
 * by the founder after Migration 003 + Resend DNS are in place.
 *
 * Usage:
 *   npx tsx scripts/run-tier-1-migration.ts --dry-run
 *   npx tsx scripts/run-tier-1-migration.ts --confirm
 *
 * Required env (loaded via dotenv):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY              (only required when --confirm)
 *   AUTH_FROM_EMAIL             defaults to "UpdateWave <auth@auth.updatewave.com>"
 *   AUTH_REDIRECT_URL           defaults to NEXT_PUBLIC_BASE_URL || production URL
 *
 * Pre-flight halts:
 *   - audience size > 50: looks more like marketing than transactional
 *   - duplicate emails detected: blocks the upcoming UNIQUE constraint
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const TIER_1_HARD_LIMIT = 50
const SEND_DELAY_MS = 1000

interface Tier1Target {
  user_id: number
  email: string
  hash: string
  product_label: string
  purchased_on: string
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const dryRun = args.has('--dry-run')
  const confirm = args.has('--confirm')

  if (!dryRun && !confirm) {
    console.error('Pass either --dry-run or --confirm')
    process.exit(2)
  }

  const supabase = createServiceClient()

  const dupes = await detectDuplicateEmails(supabase)
  if (dupes.length > 0) {
    console.error('Duplicate emails detected. Resolve manually before continuing:')
    for (const d of dupes) console.error(`  ${d.email} (count=${d.count})`)
    process.exit(2)
  }

  const targets = await loadTier1Targets(supabase)
  console.log(`Tier 1 targets: ${targets.length}`)
  if (targets.length === 0) {
    console.log('No targets found. Exiting.')
    return
  }
  if (targets.length > TIER_1_HARD_LIMIT) {
    console.error(
      `Audience size ${targets.length} exceeds Tier 1 hard limit ${TIER_1_HARD_LIMIT}. Halting; revise design.`
    )
    process.exit(2)
  }

  if (dryRun) {
    console.log('--- DRY RUN: targets ---')
    for (const t of targets) {
      console.log(`  user_id=${t.user_id} email=${t.email} ${t.product_label} purchased=${t.purchased_on}`)
    }
    return
  }

  // --confirm path: actually send.
  const apiKey = requireEnv('RESEND_API_KEY')
  const fromAddress = process.env.AUTH_FROM_EMAIL ?? 'UpdateWave <auth@auth.updatewave.com>'
  const redirectBase = resolveRedirectBase()

  let sent = 0
  let failed = 0
  for (const target of targets) {
    try {
      const link = await generateMagicLink(supabase, target.email, redirectBase)
      await sendActivationEmail(apiKey, fromAddress, target, link)
      sent += 1
      console.log(`SENT  ${target.email}`)
    } catch (err) {
      failed += 1
      console.error(`FAIL  ${target.email}: ${err instanceof Error ? err.message : err}`)
    }
    await new Promise((r) => setTimeout(r, SEND_DELAY_MS))
  }

  console.log(`Done. sent=${sent} failed=${failed}`)
  if (failed > 0) process.exit(1)
}

function createServiceClient() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env: ${name}`)
    process.exit(2)
  }
  return v
}

function resolveRedirectBase(): string {
  return (
    process.env.AUTH_REDIRECT_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    'https://updatewave-web.vercel.app'
  )
}

async function detectDuplicateEmails(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Array<{ email: string; count: number }>> {
  const { data, error } = await supabase
    .from('users')
    .select('email')
    .not('email', 'is', null)
    .is('deleted_at', null)
  if (error) throw new Error(`duplicate scan failed: ${error.message}`)

  const counts = new Map<string, number>()
  for (const row of (data ?? []) as { email: string }[]) {
    counts.set(row.email, (counts.get(row.email) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([email, count]) => ({ email, count }))
}

async function loadTier1Targets(
  supabase: ReturnType<typeof createServiceClient>
): Promise<Tier1Target[]> {
  const { data: revealUsers, error: revealErr } = await supabase
    .from('reveals')
    .select('user_id, created_at')
    .order('created_at', { ascending: false })
  if (revealErr) throw new Error(`reveals scan failed: ${revealErr.message}`)

  const { data: listUsers, error: listErr } = await supabase
    .from('list_purchases')
    .select('user_id, purchased_at')
    .order('purchased_at', { ascending: false })
  if (listErr) throw new Error(`list_purchases scan failed: ${listErr.message}`)

  const purchaseByUser = new Map<number, { product_label: string; purchased_on: string }>()
  for (const r of (revealUsers ?? []) as { user_id: number; created_at: string }[]) {
    if (!purchaseByUser.has(r.user_id)) {
      purchaseByUser.set(r.user_id, {
        product_label: 'a UpdateWave reveal',
        purchased_on: r.created_at.slice(0, 10),
      })
    }
  }
  for (const r of (listUsers ?? []) as { user_id: number; purchased_at: string }[]) {
    if (!purchaseByUser.has(r.user_id)) {
      purchaseByUser.set(r.user_id, {
        product_label: 'a UpdateWave city report',
        purchased_on: r.purchased_at.slice(0, 10),
      })
    }
  }

  if (purchaseByUser.size === 0) return []

  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('id, email, hash')
    .in('id', [...purchaseByUser.keys()])
    .not('email', 'is', null)
    .is('deleted_at', null)
  if (userErr) throw new Error(`user scan failed: ${userErr.message}`)

  const targets: Tier1Target[] = []
  for (const u of (users ?? []) as { id: number; email: string; hash: string }[]) {
    const purchase = purchaseByUser.get(u.id)
    if (!purchase) continue
    targets.push({
      user_id: u.id,
      email: u.email,
      hash: u.hash,
      product_label: purchase.product_label,
      purchased_on: purchase.purchased_on,
    })
  }
  return targets
}

async function generateMagicLink(
  supabase: ReturnType<typeof createServiceClient>,
  email: string,
  redirectBase: string
): Promise<string> {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${redirectBase}/auth/callback` },
  })
  if (error) throw new Error(`generateLink failed: ${error.message}`)
  const link = data.properties?.action_link
  if (!link) throw new Error('generateLink returned no action_link')
  return link
}

async function sendActivationEmail(
  apiKey: string,
  fromAddress: string,
  target: Tier1Target,
  magicLink: string
): Promise<void> {
  const subject = '[UpdateWave] Set up email login for your account'
  const html = `<p>Hi,</p>
<p>You purchased ${escapeHtml(target.product_label)} on ${escapeHtml(
    target.purchased_on
  )}. We've added email login so you can access your account without the original link.</p>
<p><a href="${magicLink}">Click here to set up email login</a></p>
<p>This link is single-use and expires in one hour. If you didn't expect this email, you can ignore it.</p>
<p>— Matthew, UpdateWave</p>`

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: target.email,
      subject,
      html,
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Resend ${resp.status}: ${text}`)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return c
    }
  })
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
