'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { buttonStyles } from '@/components/ui/Button'
import ReviewActions from './ReviewActions'
import {
  sortLeadItems,
  pickSort,
  type LeadItem,
  type SortKey,
  type SortState,
  type DateField,
} from './leads-sort'

type ReviewStatus = 'candidate' | 'published'

interface GroupConfig {
  title: string
  status: ReviewStatus
  items: LeadItem[]
  dateField: DateField
  dateLabel: string
  emptyText: string
  defaultCollapsed: boolean
}

export default function LeadsBoard({
  candidates,
  published,
}: {
  candidates: LeadItem[]
  published: LeadItem[]
}) {
  return (
    <>
      <LeadGroup
        title="待审"
        status="candidate"
        items={candidates}
        dateField="created_at"
        dateLabel="录入时间"
        emptyText="🎉 没有待审 lead — 等下一批 AI 抓取。"
        defaultCollapsed={false}
      />
      <LeadGroup
        title="已上线"
        status="published"
        items={published}
        dateField="published_at"
        dateLabel="上线时间"
        emptyText="还没有已上线的 lead。"
        defaultCollapsed
      />
    </>
  )
}

function LeadGroup({
  title,
  status,
  items,
  dateField,
  dateLabel,
  emptyText,
  defaultCollapsed,
}: GroupConfig) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const sorted = sortLeadItems(items, sort.key, sort.dir, dateField)

  return (
    <section className="mb-10" data-testid={`section-${status}`}>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="w-full flex items-baseline justify-between gap-4 border-b border-ink pb-2 text-left cursor-pointer group"
        data-testid={`section-toggle-${status}`}
      >
        <h2 className="font-serif text-[22px] font-semibold tracking-tight flex items-center gap-2">
          <Caret open={!collapsed} />
          {title}
        </h2>
        <span className="font-mono text-[12px] text-muted whitespace-nowrap group-hover:text-accent">
          {items.length} 条{collapsed ? ' · 展开' : ''}
        </span>
      </button>

      {!collapsed &&
        (items.length === 0 ? (
          <p className="font-mono text-[13px] text-muted py-4" data-testid={`empty-${status}`}>
            {emptyText}
          </p>
        ) : (
          <>
            <SortToolbar sort={sort} onPick={(k) => setSort((s) => pickSort(k, s))} dateLabel={dateLabel} />
            <ul className="list-none p-0 border border-ink divide-y divide-grey-200">
              {sorted.map((item) => (
                <LeadRow
                  key={item.project.id}
                  item={item}
                  status={status}
                  dateField={dateField}
                  dateLabel={dateLabel}
                  expanded={expandedId === item.project.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === item.project.id ? null : item.project.id))
                  }
                />
              ))}
            </ul>
          </>
        ))}
    </section>
  )
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: '' }, // label filled from dateLabel
  { key: 'address', label: '地址' },
  { key: 'value', label: '估值' },
]

function SortToolbar({
  sort,
  onPick,
  dateLabel,
}: {
  sort: SortState
  onPick: (key: SortKey) => void
  dateLabel: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 font-mono text-[11px] text-muted">
      <span className="uppercase tracking-[0.15em]">排序</span>
      {SORT_OPTIONS.map((opt) => {
        const label = opt.key === 'date' ? dateLabel : opt.label
        const active = sort.key === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onPick(opt.key)}
            aria-pressed={active}
            data-testid={`sort-${opt.key}`}
            className={`cursor-pointer tracking-wide ${
              active
                ? 'text-ink underline decoration-accent decoration-2 underline-offset-4'
                : 'hover:text-ink'
            }`}
          >
            {label}
            {active && <span className="ml-1 text-accent">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
          </button>
        )
      })}
    </div>
  )
}

function LeadRow({
  item,
  status,
  dateField,
  dateLabel,
  expanded,
  onToggle,
}: {
  item: LeadItem
  status: ReviewStatus
  dateField: DateField
  dateLabel: string
  expanded: boolean
  onToggle: () => void
}) {
  const { project, drawings } = item
  const isPublished = status === 'published'
  const meta = [project.city, project.project_type || undefined, formatDate(project[dateField])]
    .filter(Boolean)
    .join(' · ')

  return (
    <li data-testid="lead-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-grey-100 transition-colors"
        data-testid="lead-row"
      >
        <Caret open={expanded} />
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-[16px] font-semibold leading-tight truncate">
            {project.address}
          </span>
          <span className="block font-mono text-[11px] text-muted mt-0.5 truncate">
            {meta}
            {drawings.length > 0 && <span className="text-ink"> · 图纸 {drawings.length}</span>}
          </span>
        </span>
        <StatusBadge published={isPublished} />
      </button>

      {expanded && (
        <LeadDetail project={project} drawings={drawings} status={status} dateLabel={dateLabel} />
      )}
    </li>
  )
}

function LeadDetail({
  project,
  drawings,
  status,
  dateLabel,
}: {
  project: LeadItem['project']
  drawings: LeadItem['drawings']
  status: ReviewStatus
  dateLabel: string
}) {
  const isPublished = status === 'published'
  return (
    <div className="border-t border-grey-200 bg-paper px-4 py-5" data-testid="lead-detail">
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <Field label="类型" value={project.project_type} />
        <Field label="估值" value={project.estimated_value} />
        <Field label="Filing date" value={formatDate(project.filing_date)} />
        <Field
          label={dateLabel}
          value={formatDate(isPublished ? project.published_at : project.created_at)}
        />
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

      {(project.last_action_date || project.last_action_summary) && (
        <div className="border-t border-grey-200 pt-4 mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-2">
            最新进展 · Last action
          </p>
          <p className="font-mono text-[13px] text-ink leading-relaxed">
            {project.last_action_date && (
              <span className="text-muted">{formatDate(project.last_action_date)} — </span>
            )}
            {project.last_action_summary ?? '—'}
          </p>
        </div>
      )}

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
        <ReviewActions projectId={project.id} status={status} />
      </div>
    </div>
  )
}

function StatusBadge({ published }: { published: boolean }) {
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 whitespace-nowrap border ${
        published ? 'border-accent text-accent' : 'border-grey-300 text-muted'
      }`}
    >
      {published ? 'Published' : 'Candidate'}
    </span>
  )
}

/** Mono caret that points right when closed, down when open. Brand-plain, no icon lib. */
function Caret({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="font-mono text-[11px] text-muted leading-none select-none">
      {open ? '▾' : '▸'}
    </span>
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
