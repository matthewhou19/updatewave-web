import Link from 'next/link'
import { Project } from '@/lib/types'
import ProjectCard from '../ProjectCard'
import { buttonStyles } from '../ui/Button'

interface Props {
  projects: Project[]
  totalCount: number
}

export default function ListingsPreview({ projects, totalCount }: Props) {
  return (
    <section id="listings" className="bg-grey-100 border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            See what&apos;s filed in San Jose right now.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3">
            Free to browse. $25 to reveal contact info. New listings every few hours.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-grey-300 bg-paper">
            <p className="font-serif text-[24px] mb-1">No public listings right now.</p>
            <p className="font-mono text-[12px] text-muted">Check back soon — new ones land every few hours.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} isRevealed={false} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/login" className={buttonStyles('primary')}>
            View all {totalCount} listings →
          </Link>
          <p className="font-mono text-[11px] text-muted mt-3">
            Free account required to browse the full list. No payment to view.
          </p>
        </div>
      </div>
    </section>
  )
}
