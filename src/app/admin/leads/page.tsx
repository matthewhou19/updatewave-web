import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/admin-auth'
import { logoutAdmin } from '../login/actions'
import { fetchCandidateProjects, fetchPublishedProjectsForReview } from '@/lib/admin-queries'
import { listDrawings } from '@/lib/drawings'
import LeadsBoard from './LeadsBoard'
import type { LeadItem } from './leads-sort'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  if (!(await isAdminAuthed())) {
    redirect('/admin/login?next=/admin/leads')
  }

  const service = createSupabaseServiceClient()
  const [{ projects: candidates }, { projects: published }] = await Promise.all([
    fetchCandidateProjects(service),
    fetchPublishedProjectsForReview(service),
  ])

  // One storage list per shown lead; run them all in parallel, then zip each
  // lead together with its drawings so client-side sorting can't desync them.
  const [candidateDrawings, publishedDrawings] = await Promise.all([
    Promise.all(candidates.map((p) => listDrawings(service, p.id))),
    Promise.all(published.map((p) => listDrawings(service, p.id))),
  ])

  const candidateItems: LeadItem[] = candidates.map((project, i) => ({
    project,
    drawings: candidateDrawings[i],
  }))
  const publishedItems: LeadItem[] = published.map((project, i) => ({
    project,
    drawings: publishedDrawings[i],
  }))

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="border-b border-ink bg-paper">
        <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between gap-6">
          <span className="font-serif font-extrabold text-[20px] tracking-tight">
            UpdateWave<span className="text-accent">.</span>{' '}
            <span className="font-mono text-[12px] font-normal text-muted">Lead review</span>
          </span>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="font-mono text-[12px] text-muted hover:text-accent underline decoration-dotted underline-offset-2"
              data-testid="admin-logout"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-[1100px] w-full mx-auto px-6 md:px-12 py-10 flex-1">
        <div className="mb-10 flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-[28px] font-semibold tracking-tight">Lead 审核</h1>
          <p className="font-mono text-[12px] text-muted whitespace-nowrap" data-testid="counts">
            待审 {candidates.length} · 已上线 {published.length}
          </p>
        </div>

        <LeadsBoard candidates={candidateItems} published={publishedItems} />
      </main>
    </div>
  )
}
