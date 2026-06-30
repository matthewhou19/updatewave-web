import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/admin-auth'
import { logoutAdmin } from '../login/actions'
import { fetchCandidateProjects } from '@/lib/admin-queries'
import { listDrawings, type Drawing } from '@/lib/drawings'
import { Project } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { buttonStyles } from '@/components/ui/Button'
import ReviewActions from './ReviewActions'

export const dynamic = 'force-dynamic'

export default async function AdminLeadsPage() {
  if (!(await isAdminAuthed())) {
    redirect('/admin/login?next=/admin/leads')
  }

  const service = createSupabaseServiceClient()
  const { projects } = await fetchCandidateProjects(service)

  // One storage list per lead; run them in parallel.
  const drawingsByProject = await Promise.all(
    projects.map((p) => listDrawings(service, p.id))
  )

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
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-serif text-[28px] font-semibold tracking-tight">待审 Lead</h1>
          <p className="font-mono text-[12px] text-muted whitespace-nowrap" data-testid="pending-count">
            待审 {projects.length} 条
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="border border-ink p-10 text-center" data-testid="empty-state">
            <p className="font-mono text-[14px] text-ink">🎉 没有待审 lead</p>
            <p className="font-mono text-[12px] text-muted mt-2">等下一批 AI 抓取。</p>
          </div>
        ) : (
          <ul className="space-y-6 list-none p-0">
            {projects.map((project, i) => (
              <LeadCard key={project.id} project={project} drawings={drawingsByProject[i]} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function LeadCard({ project, drawings }: { project: Project; drawings: Drawing[] }) {
  return (
    <li className="border border-ink bg-paper p-6" data-testid="lead-card">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="font-serif text-[20px] font-semibold leading-tight">{project.address}</h2>
          <p className="font-mono text-[12px] text-muted mt-1">{project.city}</p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted border border-grey-300 px-2 py-1 whitespace-nowrap">
          Candidate
        </span>
      </div>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Field label="类型" value={project.project_type} />
        <Field label="估值" value={project.estimated_value} />
        <Field label="Filing date" value={formatDate(project.filing_date)} />
        <Field label="录入时间" value={formatDate(project.created_at)} />
      </dl>

      <div className="border-t border-grey-200 pt-4 mb-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-3">建筑师</p>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="姓名" value={project.architect_name} />
          <Field label="事务所" value={project.architect_firm} />
          <Field label="联系方式" value={project.architect_contact} />
          <Field label="网站" value={project.architect_website} href={project.architect_website} />
        </dl>
      </div>

      {project.description && (
        <p className="font-mono text-[13px] text-ink leading-relaxed mb-5 whitespace-pre-wrap">
          {project.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5 font-mono text-[12px]">
        {project.source_url && (
          <a
            href={project.source_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-ink underline decoration-dotted underline-offset-2 hover:text-accent break-all"
          >
            源链接 ↗
          </a>
        )}
        {project.source_permit_id !== null && (
          <span className="text-muted">Permit #{project.source_permit_id}</span>
        )}
      </div>

      {drawings.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2" data-testid="drawings">
          {drawings.map((d) => (
            <a
              key={d.name}
              href={d.url}
              download={d.name}
              title={d.name}
              className={buttonStyles('outline', 'sm')}
              data-testid="drawing-download"
            >
              ↓ 下载图纸{drawings.length > 1 ? `：${d.name}` : ''}
            </a>
          ))}
        </div>
      )}

      <div className="border-t border-grey-200 pt-4">
        <ReviewActions projectId={project.id} />
      </div>
    </li>
  )
}

function Field({
  label,
  value,
  href,
}: {
  label: string
  value: string | null | undefined
  href?: string | null
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-0.5">{label}</dt>
      <dd className="font-mono text-[12px] text-ink break-words">
        {value ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-muted">—</span>
        )}
      </dd>
    </div>
  )
}
