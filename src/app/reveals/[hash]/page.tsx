import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  ListPurchaseWithCityList,
  ResearchPurchaseWithCityList,
  RevealWithProject,
  User,
} from '@/lib/types'
import { fetchUserByHash, fetchUserListPurchases, fetchUserResearchPurchases } from '@/lib/queries'
import { formatProjectType } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import { buttonStyles } from '@/components/ui/Button'

interface RevealsPageProps {
  params: Promise<{ hash: string }>
}

export default async function RevealsPage({ params }: RevealsPageProps) {
  const { hash } = await params
  const supabase = createSupabaseServiceClient()

  const { user, error: userError } = await fetchUserByHash(supabase, hash)

  if (userError || !user) {
    return (
      <div className="min-h-screen bg-paper text-ink flex flex-col">
        <TopBar view="public" />
        <main className="flex-1 flex items-center justify-center px-6 py-24">
          <p className="font-mono text-[14px] text-muted text-center max-w-md">
            This link isn&apos;t valid. Check your email for the correct URL.
          </p>
        </main>
      </div>
    )
  }

  const typedUser = user as User

  const [revealsResult, listsResult, researchResult] = await Promise.all([
    supabase
      .from('reveals')
      .select(`
        id,
        user_id,
        project_id,
        stripe_payment_id,
        amount_cents,
        created_at,
        projects (
          address,
          city,
          project_type,
          estimated_value,
          architect_name,
          architect_firm,
          architect_contact,
          architect_website,
          filing_date,
          source_url,
          status
        )
      `)
      .eq('user_id', typedUser.id)
      .order('created_at', { ascending: false }),
    fetchUserListPurchases(supabase, typedUser.id),
    fetchUserResearchPurchases(supabase, typedUser.id),
  ])

  type RawReveal = {
    id: number
    user_id: number
    project_id: number
    stripe_payment_id: string | null
    amount_cents: number | null
    created_at: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: any
  }

  const revealList: RevealWithProject[] = (revealsResult.data ?? []).map((r: RawReveal) => {
    const proj = Array.isArray(r.projects) ? r.projects[0] : r.projects
    return {
      id: r.id,
      user_id: r.user_id,
      project_id: r.project_id,
      stripe_payment_id: r.stripe_payment_id,
      amount_cents: r.amount_cents,
      created_at: r.created_at,
      address: proj?.address ?? '',
      city: proj?.city ?? '',
      project_type: proj?.project_type ?? null,
      estimated_value: proj?.estimated_value ?? null,
      architect_name: proj?.architect_name ?? null,
      architect_firm: proj?.architect_firm ?? null,
      architect_contact: proj?.architect_contact ?? null,
      architect_website: proj?.architect_website ?? null,
      filing_date: proj?.filing_date ?? null,
      source_url: proj?.source_url ?? null,
      status: proj?.status ?? 'published',
    }
  })

  const listPurchases: ListPurchaseWithCityList[] = listsResult.purchases
  const researchPurchases: ResearchPurchaseWithCityList[] = researchResult.purchases
  const totalPurchases = revealList.length + listPurchases.length + researchPurchases.length

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar hash={hash} view="reveals" />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1">
        <h1 className="font-serif text-[32px] md:text-[40px] font-semibold tracking-tight mb-8">
          My purchases
        </h1>

        {totalPurchases === 0 ? (
          <div
            className="text-center py-16 border border-dashed border-grey-300"
            data-testid="empty-reveals"
          >
            <p className="font-serif text-[24px] mb-3">No purchases yet.</p>
            <p className="font-mono text-[13px] text-muted mb-6">
              Browse the listings and reveal the ones worth chasing.
            </p>
            <Link href={`/browse/${hash}`} className={buttonStyles('primary')}>
              Browse available projects →
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {researchPurchases.length > 0 && <ResearchSection hash={hash} purchases={researchPurchases} />}
            {listPurchases.length > 0 && <ListPurchasesSection hash={hash} purchases={listPurchases} />}
            {revealList.length > 0 && <RevealsSection reveals={revealList} />}
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function SectionHeading({ children, count }: { children: string; count: number }) {
  return (
    <div className="flex items-baseline gap-3 mb-4 border-b border-ink pb-2">
      <h2 className="font-serif text-[22px] font-semibold tracking-tight">{children}</h2>
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">({count})</span>
    </div>
  )
}

interface ResearchSectionProps {
  hash: string
  purchases: ResearchPurchaseWithCityList[]
}

function ResearchSection({ hash, purchases }: ResearchSectionProps) {
  return (
    <section data-testid="section-research">
      <SectionHeading count={purchases.length}>Custom research</SectionHeading>
      <div className="space-y-3">
        {purchases.map((p) => (
          <Link
            key={p.id}
            href={`/research/${hash}/${p.city}/status`}
            data-testid="research-card"
            className="block border border-ink bg-paper p-5 hover:bg-grey-100 transition-colors no-underline"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="font-serif text-[18px] font-semibold tracking-tight">{p.title}</span>
              <ResearchStatusBadge status={p.delivery_status} />
            </div>
            <p className="font-mono text-[12px] text-muted">
              Purchased {formatDate(p.purchased_at)}
              {p.delivered_at && <> · Delivered {formatDate(p.delivered_at)}</>}
            </p>
            <p className="font-mono text-[12px] text-accent mt-3">
              {p.delivery_status === 'delivered' ? 'View & download →' : 'View status →'}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function ResearchStatusBadge({ status }: { status: ResearchPurchaseWithCityList['delivery_status'] }) {
  const map = {
    delivered: { label: 'Delivered', cls: 'border-accent text-accent', dot: '●' },
    pending: { label: 'In progress', cls: 'border-ink text-ink', dot: '○' },
    in_research: { label: 'In progress', cls: 'border-ink text-ink', dot: '○' },
    cancelled: { label: 'Refunded', cls: 'border-grey-300 text-muted line-through', dot: '✕' },
  } as const
  const { label, cls, dot } = map[status]
  return (
    <span
      className={`flex-shrink-0 inline-block px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] border ${cls}`}
    >
      <span className="mr-1" aria-hidden>{dot}</span>
      {label}
    </span>
  )
}

interface ListPurchasesSectionProps {
  hash: string
  purchases: ListPurchaseWithCityList[]
}

function ListPurchasesSection({ hash, purchases }: ListPurchasesSectionProps) {
  return (
    <section data-testid="section-reports">
      <SectionHeading count={purchases.length}>City reports</SectionHeading>
      <div className="space-y-3">
        {purchases.map((p) => (
          <Link
            key={p.id}
            href={`/list/${hash}/${p.city}/success`}
            data-testid="report-card"
            className="block border border-ink bg-paper p-5 hover:bg-grey-100 transition-colors no-underline"
          >
            <span className="block font-serif text-[18px] font-semibold tracking-tight mb-1">
              {p.title}
            </span>
            <p className="font-mono text-[12px] text-muted">Purchased {formatDate(p.purchased_at)}</p>
            <p className="font-mono text-[12px] text-accent mt-3">Download report →</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function RevealsSection({ reveals }: { reveals: RevealWithProject[] }) {
  return (
    <section data-testid="section-reveals">
      <SectionHeading count={reveals.length}>Reveals</SectionHeading>
      <div className="space-y-3">
        {reveals.map((reveal) => (
          <div
            key={reveal.id}
            data-testid="project-card"
            className="border border-ink bg-paper p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="font-serif text-[20px] font-semibold tracking-tight leading-tight">
                {reveal.address}
              </span>
              {reveal.status === 'stale' && (
                <span className="flex-shrink-0 inline-block px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] border border-grey-300 text-muted">
                  Stale
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap font-mono text-[11px]">
              {reveal.project_type && (
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] border border-grey-300 text-muted">
                  {formatProjectType(reveal.project_type)}
                </span>
              )}
              {reveal.city && (
                <span className="px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] border border-grey-300 text-muted">
                  {reveal.city}
                </span>
              )}
              {reveal.estimated_value && <span className="text-muted">{reveal.estimated_value}</span>}
              {reveal.filing_date && (
                <span className="text-muted">Filed {formatDate(reveal.filing_date)}</span>
              )}
            </div>

            <div className="space-y-1">
              {reveal.architect_firm && (
                <p className="font-serif text-[16px] font-semibold">{reveal.architect_firm}</p>
              )}
              {reveal.architect_contact && (
                <p className="font-mono text-[12px] text-muted">{reveal.architect_contact}</p>
              )}
              {reveal.architect_website && (
                <a
                  href={reveal.architect_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] text-accent border-b border-accent break-all"
                >
                  {reveal.architect_website}
                </a>
              )}
              {reveal.source_url && (
                <a
                  href={reveal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-mono text-[11px] text-muted hover:text-ink mt-2"
                >
                  View permit filing ↗
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
