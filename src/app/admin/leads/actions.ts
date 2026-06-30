'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/admin-auth'

export type ActionResult = { ok: true } | { ok: false; error: string }

type Status = 'candidate' | 'published' | 'archived'

/**
 * Move a lead between review states, guarded on its current status so a
 * double-click or a race affects 0 rows. A Server Action is an independently
 * callable endpoint, so we re-verify the admin here (defense in depth). The
 * service-role client bypasses RLS; a project_status_log audit row is written
 * (best-effort).
 *
 *   approve:  candidate -> published  (sets published_at, reviewed_at)
 *   reject:   candidate -> archived   (sets reviewed_at)
 *   withdraw: published -> candidate  (clears published_at; back to the queue)
 */
async function transition(
  projectId: number,
  fromStatus: Status,
  toStatus: Status,
  extraPatch: Record<string, string | null>
): Promise<ActionResult> {
  if (!Number.isInteger(projectId) || projectId <= 0) {
    return { ok: false, error: 'Invalid lead id.' }
  }

  if (!(await isAdminAuthed())) {
    return { ok: false, error: 'Not authorized.' }
  }

  const service = createSupabaseServiceClient()

  const { data: updated, error: updateError } = await service
    .from('projects')
    .update({ status: toStatus, ...extraPatch })
    .eq('id', projectId)
    .eq('status', fromStatus)
    .select('id')

  if (updateError) {
    return { ok: false, error: 'Database error. Try again.' }
  }

  if (!updated || updated.length === 0) {
    return { ok: false, error: 'Already changed by another action. Refresh.' }
  }

  await service.from('project_status_log').insert({
    project_id: projectId,
    old_status: fromStatus,
    new_status: toStatus,
    changed_by: 'admin',
  })

  revalidatePath('/admin/leads')
  return { ok: true }
}

export async function approveLead(projectId: number): Promise<ActionResult> {
  const now = new Date().toISOString()
  return transition(projectId, 'candidate', 'published', { published_at: now, reviewed_at: now })
}

export async function rejectLead(projectId: number): Promise<ActionResult> {
  return transition(projectId, 'candidate', 'archived', { reviewed_at: new Date().toISOString() })
}

export async function withdrawLead(projectId: number): Promise<ActionResult> {
  // Un-publish: take it off the live site and back to the pending queue, where
  // it can be re-approved or rejected. Clear published_at.
  return transition(projectId, 'published', 'candidate', { published_at: null })
}
