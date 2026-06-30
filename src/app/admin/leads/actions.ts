'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { resolveAdmin } from '@/lib/admin'

export type ActionResult = { ok: true } | { ok: false; error: string }

type TargetStatus = 'published' | 'archived'

/**
 * Move a candidate lead to `published` (approve) or `archived` (reject).
 *
 * Security: a Server Action is an independently-callable endpoint, so we
 * re-verify the admin here rather than trusting the page gate (defense in
 * depth). All writes use the service-role client (RLS bypass).
 *
 * Idempotency: the `status='candidate'` guard means a double-click or a race
 * affects 0 rows the second time, so we never re-publish or double-log.
 */
async function transition(projectId: number, toStatus: TargetStatus): Promise<ActionResult> {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { ok: false, error: 'Invalid lead id.' }
  }

  const cookieClient = await createSupabaseServerClient()
  const admin = await resolveAdmin(cookieClient)
  if (!admin.ok) {
    return { ok: false, error: 'Not authorized.' }
  }

  const service = createSupabaseServiceClient()
  const now = new Date().toISOString()

  const patch =
    toStatus === 'published'
      ? { status: 'published', published_at: now, reviewed_at: now }
      : { status: 'archived', reviewed_at: now }

  const { data: updated, error: updateError } = await service
    .from('projects')
    .update(patch)
    .eq('id', projectId)
    .eq('status', 'candidate')
    .select('id')

  if (updateError) {
    return { ok: false, error: 'Database error. Try again.' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'Already processed (no longer a candidate).' }
  }

  // Audit trail is best-effort: the status change already committed, so a
  // logging failure must not fail the action. Mirrors the auth-callback's
  // best-effort event logging.
  await service.from('project_status_log').insert({
    project_id: projectId,
    old_status: 'candidate',
    new_status: toStatus,
    changed_by: `admin:${admin.email}`,
  })

  revalidatePath('/admin/leads')
  return { ok: true }
}

export async function approveLead(projectId: number): Promise<ActionResult> {
  return transition(projectId, 'published')
}

export async function rejectLead(projectId: number): Promise<ActionResult> {
  return transition(projectId, 'archived')
}
