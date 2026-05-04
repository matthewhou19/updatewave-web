import { SupabaseClient } from '@supabase/supabase-js'
import { generateUserHash } from './hash-gen'
import { IdentitySimilaritySignal, User } from './types'

export interface ForkAlertInfo {
  user_id_likely_old: number
  similarity_signal: IdentitySimilaritySignal
}

export interface AuthResolutionResult {
  user: User
  isNew: boolean
  forkAlert: ForkAlertInfo | null
}

/**
 * Resolve a magic-link login to a `public.users` row, creating one if needed.
 *
 * Runs the 4-case identity model in order. The first hit wins:
 *   1. Linked match            — users.auth_user_id = $authUserId
 *   2. Stale auth_user_id      — users.email = $authEmail with stale link
 *   3. First link of existing  — users.email = $authEmail not yet linked
 *   4. Brand-new user          — INSERT with fresh hash + fork detection
 *
 * Cases 1-3 also enforce `deleted_at IS NULL`. A soft-deleted match falls
 * through to case 4, where the UNIQUE(email) constraint catches it and the
 * caller surfaces a "this account is no longer active" error.
 *
 * Case 4 uses `ON CONFLICT (auth_user_id) DO NOTHING` (via Supabase upsert
 * with `ignoreDuplicates: true`). If two tabs race, the loser re-queries
 * case 1 to land on the winner's row.
 *
 * Pass a service-role Supabase client. RLS would otherwise block the writes
 * required for cases 2-4.
 */
export async function resolveAuthLogin(
  supabase: SupabaseClient,
  authUserId: string,
  authEmail: string
): Promise<AuthResolutionResult> {
  // Normalize the email before any equality comparison. Supabase Auth
  // already lowercases, but explicit normalization defends against any
  // future caller that passes through non-Supabase-Auth-sourced emails,
  // and the CHECK constraint on users.email enforces it on the write side.
  const email = authEmail.toLowerCase()

  // Case 1: linked match
  const linked = await findUserByAuthUserId(supabase, authUserId)
  if (linked) {
    return { user: linked, isNew: false, forkAlert: null }
  }

  // Case 2: stale auth_user_id rotation
  const stale = await findUserByEmailWithStaleAuth(supabase, email)
  if (stale) {
    const rotated = await setAuthUserId(supabase, stale.id, authUserId)
    return { user: rotated, isNew: false, forkAlert: null }
  }

  // Case 3: first link of existing user
  const unlinked = await findUserByEmailUnlinked(supabase, email)
  if (unlinked) {
    const linkedNow = await setAuthUserId(supabase, unlinked.id, authUserId)
    return { user: linkedNow, isNew: false, forkAlert: null }
  }

  // Case 4: brand-new user
  const inserted = await insertBrandNewUser(supabase, authUserId, email)
  if (!inserted) {
    // Race: another tab created the row first. Re-query case 1.
    const winner = await findUserByAuthUserId(supabase, authUserId)
    if (!winner) {
      throw new Error('Auth resolution race: insert conflicted but no row found by auth_user_id')
    }
    return { user: winner, isNew: false, forkAlert: null }
  }

  const forkAlert = await detectIdentityFork(supabase, email, inserted.id)
  if (forkAlert) {
    await writeForkAlert(supabase, inserted.id, forkAlert)
  }

  return { user: inserted, isNew: true, forkAlert }
}

// ─── Case 1 ─────────────────────────────────────────────────────────────────

async function findUserByAuthUserId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as User | null) ?? null
}

// ─── Case 2 ─────────────────────────────────────────────────────────────────

async function findUserByEmailWithStaleAuth(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .not('auth_user_id', 'is', null)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as User | null) ?? null
}

// ─── Case 3 ─────────────────────────────────────────────────────────────────

async function findUserByEmailUnlinked(
  supabase: SupabaseClient,
  email: string
): Promise<User | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .is('auth_user_id', null)
    .is('deleted_at', null)
    .maybeSingle()
  return (data as User | null) ?? null
}

// ─── Cases 2 + 3: write the new auth_user_id ────────────────────────────────

async function setAuthUserId(
  supabase: SupabaseClient,
  userId: number,
  authUserId: string
): Promise<User> {
  // The deleted_at filter guards a narrow race: the row was non-deleted
  // when we read it for case 2 / case 3, but an admin soft-deleted it
  // before this UPDATE landed. Without the filter we would write
  // auth_user_id onto a deleted row and return it as a "logged in" user.
  const { data, error } = await supabase
    .from('users')
    .update({ auth_user_id: authUserId })
    .eq('id', userId)
    .is('deleted_at', null)
    .select('*')
    .maybeSingle()
  if (error) {
    throw new Error(`Failed to set auth_user_id on user ${userId}: ${error.message}`)
  }
  if (!data) {
    throw new Error(`User ${userId} was soft-deleted between read and write`)
  }
  return data as User
}

// ─── Case 4: insert ─────────────────────────────────────────────────────────

async function insertBrandNewUser(
  supabase: SupabaseClient,
  authUserId: string,
  email: string
): Promise<User | null> {
  const hash = generateUserHash()
  const { data, error } = await supabase
    .from('users')
    .upsert(
      { hash, email, auth_user_id: authUserId },
      { onConflict: 'auth_user_id', ignoreDuplicates: true }
    )
    .select('*')
    .maybeSingle()

  if (error) {
    // 23505 = unique_violation. With ignoreDuplicates the auth_user_id case
    // is silenced, but a UNIQUE(email) collision (two tabs, same email,
    // somehow different cases) would still surface. Return null to let
    // caller race-recover.
    if (error.code === '23505') return null
    throw new Error(`Failed to insert new user: ${error.message}`)
  }
  return (data as User | null) ?? null
}

// ─── Identity fork detection ────────────────────────────────────────────────

export async function detectIdentityFork(
  supabase: SupabaseClient,
  newEmail: string,
  newUserId: number
): Promise<ForkAlertInfo | null> {
  const newParts = splitEmail(newEmail)
  if (!newParts) return null

  const paidIds = await listPaidUserIds(supabase)
  paidIds.delete(newUserId)
  if (paidIds.size === 0) return null

  const { data: paidUsers } = await supabase
    .from('users')
    .select('id, email')
    .in('id', Array.from(paidIds))
    .not('email', 'is', null)
    .is('deleted_at', null)

  for (const candidate of (paidUsers ?? []) as { id: number; email: string }[]) {
    const candidateParts = splitEmail(candidate.email)
    if (!candidateParts) continue

    if (
      newParts.local === candidateParts.local &&
      newParts.domain !== candidateParts.domain
    ) {
      return { user_id_likely_old: candidate.id, similarity_signal: 'same_local_part' }
    }

    if (
      newParts.domain === candidateParts.domain &&
      newParts.local !== candidateParts.local
    ) {
      return { user_id_likely_old: candidate.id, similarity_signal: 'same_domain' }
    }
  }

  return null
}

async function writeForkAlert(
  supabase: SupabaseClient,
  newUserId: number,
  alert: ForkAlertInfo
): Promise<void> {
  await supabase.from('identity_fork_alerts').insert({
    user_id_new: newUserId,
    user_id_likely_old: alert.user_id_likely_old,
    similarity_signal: alert.similarity_signal,
  })
}

async function listPaidUserIds(supabase: SupabaseClient): Promise<Set<number>> {
  // Calls the `paid_user_ids` Postgres function (defined in migration 003).
  // Returns DISTINCT user_ids across reveals + list_purchases at the DB
  // layer, so the result size is bounded by paid-user count rather than
  // purchase-row count — and avoids PostgREST's default 1000-row cap.
  const { data, error } = await supabase.rpc('paid_user_ids')
  if (error) {
    throw new Error(`paid_user_ids RPC failed: ${error.message}`)
  }
  const ids = new Set<number>()
  for (const r of (data ?? []) as { user_id: number }[]) {
    ids.add(r.user_id)
  }
  return ids
}

function splitEmail(email: string): { local: string; domain: string } | null {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  return {
    local: email.slice(0, at).toLowerCase(),
    domain: email.slice(at + 1).toLowerCase(),
  }
}
