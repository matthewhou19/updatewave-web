// One-off: seed the two test users + the SPRINGER reveal expected by
// supabase/seed-test-data.sql, against the LOCAL Supabase only.
//
// Local DB has stale rows from prior test sessions whose soft-deletes still
// occupy the partial UNIQUE on email (uniq_users_email_not_null). We hard
// delete any conflicting test rows (and their FK dependents) before fresh
// insert so this script is idempotent.
//
// SAFETY: refuses to run unless NEXT_PUBLIC_SUPABASE_URL is a 127.0.0.1 /
// localhost URL. We never want this to touch the prod project.
//
// Run from worktree root:  node scripts/seed-test-users.mjs

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnvLocal() {
  const text = readFileSync('.env.local', 'utf-8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    const value = trimmed.slice(idx + 1).replace(/^"|"$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  console.error(`Refusing to seed against non-local Supabase: ${url}`)
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

const TEST_USER = {
  hash: 'test_abcdefghijklmnopqrstuvwxyz1234567890A',
  name: 'Mike Johnson',
  company: 'Pacific Coast Builders',
  email: 'mike@pacificcoastbuilders.com',
  city_filter: 'Los Altos',
  source_campaign: 'test',
}

const EMPTY_USER = {
  hash: 'empty_reveals_test_user_hash_000000000000',
  name: 'Test Empty User',
  company: 'No Reveals Corp',
  email: 'empty@test.local',
  city_filter: 'Los Altos',
  source_campaign: 'test',
}

async function findConflictingIds(row) {
  // Hash and email each have unique constraints (hash strict, email partial-on-NOT NULL),
  // and soft-deletes still occupy them. Find any row that matches either.
  const { data, error } = await supabase
    .from('users')
    .select('id, hash, email, deleted_at')
    .or(`hash.eq.${row.hash},email.eq.${row.email}`)
  if (error) throw new Error(`scan ${row.hash}: ${error.message}`)
  return (data ?? []).map((r) => r.id)
}

async function purgeUserAndDependents(userId) {
  // Delete in FK-safe order. digest_subscriptions points to research_purchases,
  // research_purchases and list_purchases point to users.
  const tables = [
    { name: 'digest_subscriptions', fk: 'research_purchase_id', via: 'research_purchases' },
    { name: 'reveals', fk: 'user_id' },
    { name: 'list_purchases', fk: 'user_id' },
    { name: 'research_purchases', fk: 'user_id' },
  ]
  // Delete digest_subscriptions whose research_purchase belongs to this user first.
  const { data: rps } = await supabase
    .from('research_purchases')
    .select('id')
    .eq('user_id', userId)
  const rpIds = (rps ?? []).map((r) => r.id)
  if (rpIds.length > 0) {
    await supabase.from('digest_subscriptions').delete().in('research_purchase_id', rpIds)
  }
  for (const t of tables.slice(1)) {
    await supabase.from(t.name).delete().eq(t.fk, userId)
  }
  const { error } = await supabase.from('users').delete().eq('id', userId)
  if (error) throw new Error(`purge user ${userId}: ${error.message}`)
}

async function insertFresh(row) {
  const { data, error } = await supabase
    .from('users')
    .insert(row)
    .select('id, hash, email')
    .single()
  if (error) throw new Error(`insert ${row.hash}: ${error.message}`)
  return data
}

async function ensureSpringerReveal(userId) {
  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('address', '336 SPRINGER RD')
    .eq('city', 'Los Altos')
    .maybeSingle()
  if (!project) {
    console.warn('  - skip reveal: project 336 SPRINGER RD not found')
    return
  }
  const { error } = await supabase.from('reveals').insert({
    user_id: userId,
    project_id: project.id,
    stripe_payment_id: 'pi_test_seed_001',
    amount_cents: 2500,
  })
  if (error) throw new Error(`insert reveal: ${error.message}`)
  console.log(`  - inserted reveal for project ${project.id}`)
}

async function seed(row, withReveal) {
  const conflicts = await findConflictingIds(row)
  for (const id of conflicts) {
    console.log(`  - purging stale user id=${id}`)
    await purgeUserAndDependents(id)
  }
  const u = await insertFresh(row)
  console.log(`inserted user id=${u.id} hash=${u.hash}`)
  if (withReveal) await ensureSpringerReveal(u.id)
  return u
}

async function ensureSjCityList() {
  const { data: existing } = await supabase
    .from('city_lists')
    .select('id, pdf_storage_path')
    .eq('city', 'sj')
    .eq('year', 2025)
    .maybeSingle()

  // Path starts with "/" → API route serves it directly from public/reports/
  // (no Supabase Storage bucket needed for local dev).
  const STATIC_PATH = '/reports/sj-2025.html'

  if (existing) {
    if (existing.pdf_storage_path !== STATIC_PATH) {
      await supabase.from('city_lists').update({ pdf_storage_path: STATIC_PATH }).eq('id', existing.id)
      console.log(`updated city_list id=${existing.id} pdf_storage_path=${STATIC_PATH}`)
    } else {
      console.log(`city_list id=${existing.id} already points at ${STATIC_PATH}`)
    }
    return existing.id
  }

  const { data, error } = await supabase
    .from('city_lists')
    .insert({
      city: 'sj',
      year: 2025,
      title: 'San Jose Market Structure Report',
      description: '15-page structural analysis of every San Jose residential permit filed in the last year.',
      headline_insight: 'Most residential work goes to a handful of LLCs. We name them.',
      headline_insight_subtext: 'Three-tier breakdown (ADU / SFR / Multifamily), per-tier playbooks, geographic clusters.',
      price_cents: 34900,
      anchor_price_cents: 49900,
      pdf_storage_path: STATIC_PATH,
      active: true,
    })
    .select('id')
    .single()
  if (error) throw new Error(`insert city_list: ${error.message}`)
  console.log(`inserted city_list id=${data.id}`)
  return data.id
}

async function ensureSjPurchase(userId, cityListId) {
  const { data: existing } = await supabase
    .from('list_purchases')
    .select('id')
    .eq('user_id', userId)
    .eq('city_list_id', cityListId)
    .maybeSingle()
  if (existing) {
    console.log(`  - list_purchase already exists (id=${existing.id})`)
    return
  }
  const { error } = await supabase.from('list_purchases').insert({
    user_id: userId,
    city_list_id: cityListId,
    stripe_session_id: `cs_test_seed_${userId}_${cityListId}`,
    stripe_payment_id: 'pi_test_seed_list_001',
    amount_cents: 34900,
  })
  if (error) throw new Error(`insert list_purchase: ${error.message}`)
  console.log(`  - inserted list_purchase user_id=${userId} city_list_id=${cityListId}`)
}

async function main() {
  console.log(`seeding against ${url}`)
  const testUser = await seed(TEST_USER, true)
  await seed(EMPTY_USER, false)
  const cityListId = await ensureSjCityList()
  await ensureSjPurchase(testUser.id, cityListId)
  console.log('done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
