import Link from 'next/link'
import { Project } from '@/lib/types'
import ProjectCard from '../ProjectCard'
import { buttonStyles } from '../ui/Button'

interface Props {
  projects: Project[]
  /**
   * Total count of published projects in the dataset. Surfaced in the
   * "we monitored N filings this month" line so the proof feels live.
   */
  totalCount: number
}

export default function ListingsPreview({ projects, totalCount }: Props) {
  return (
    <section id="listings" className="bg-grey-100 border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            We watch every filing in San Jose.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3 max-w-[640px]">
            Below: the four most recent permits, pulled from the city this morning. The report is
            what 12 months of these filings <em className="italic">add up to</em> — concentration,
            tier breakdown, named LLCs, the playbook for each segment.
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
              <ProjectCard key={p.id} project={p} isRevealed={false} mode="demo" />
            ))}
          </div>
        )}

        <p className="font-mono text-[11px] text-muted mt-6 text-center">
          {totalCount > 0
            ? `${totalCount} San Jose filings tracked. The report structures all of them.`
            : 'San Jose filings tracked daily. The report structures all of them.'}
        </p>

        <div className="mt-8 text-center">
          <Link href="/pricing" className={buttonStyles('primary')}>
            See the SJ report → $499
          </Link>
        </div>
      </div>
    </section>
  )
}
