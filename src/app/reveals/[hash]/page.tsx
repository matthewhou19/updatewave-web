import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { User, RevealWithProject } from '@/lib/types'
import { fetchUserByHash } from '@/lib/queries'
import { formatProjectType } from '@/lib/utils'
import TopBar from '@/components/TopBar'

interface RevealsPageProps {
  params: Promise<{ hash: string }>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function RevealsPage({ params }: RevealsPageProps) {
  const { hash } = await params
  const supabase = createSupabaseServiceClient()

  // Validate hash
  const { user, error: userError } = await fetchUserByHash(supabase, hash)

  if (userError || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <p className="text-base text-[#6b7280]">
          This link isn&apos;t valid. Check your email for the correct URL.
        </p>
      </div>
    )
  }

  const typedUser = user as User

  // Fetch reveals joined with project data
  const { data: reveals } = await supabase
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
    .order('created_at', { ascending: false })

  type RawReveal = {
    id: number
    user_id: number
    project_id: number
    stripe_payment_id: string | null
    amount_cents: number | null
    created_at: string
    // Supabase join returns array or object depending on relationship type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    projects: any
  }

  // Flatten joined data
  const revealList: RevealWithProject[] = (reveals ?? []).map((r: RawReveal) => {
    // Supabase may return array or single object for foreign key joins
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

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <TopBar hash={hash} view="reveals" />

      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-[#111827] mb-6">
          My Reveals ({revealList.length})
        </h1>

        {revealList.length === 0 ? (
          <div className="text-center py-16" data-testid="empty-reveals">
            <p className="text-[#6b7280] mb-4">You haven&apos;t revealed any projects yet.</p>
            <Link
              href={`/browse/${hash}`}
              className="inline-block px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-medium rounded-md transition-colors"
            >
              Browse available projects →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {revealList.map((reveal) => (
              <div key={reveal.id} data-testid="project-card" className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-bold text-[16px] text-[#111827] leading-snug">
                    {reveal.address}
                  </span>
                  {reveal.status === 'stale' && (
                    <span className="flex-shrink-0 inline-block px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                      Stale
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {reveal.project_type && (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-[#6b7280] rounded-full">
                      {formatProjectType(reveal.project_type)}
                    </span>
                  )}
                  {reveal.city && (
                    <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-[#6b7280] rounded-full">
                      {reveal.city}
                    </span>
                  )}
                  {reveal.estimated_value && (
                    <span className="text-sm text-[#6b7280]">{reveal.estimated_value}</span>
                  )}
                  {reveal.filing_date && (
                    <span className="text-sm text-[#9ca3af]">Filed {formatDate(reveal.filing_date)}</span>
                  )}
                </div>

                <div className="space-y-0.5">
                  {reveal.architect_firm && (
                    <p className="font-bold text-sm text-[#111827]">{reveal.architect_firm}</p>
                  )}
                  {reveal.architect_contact && (
                    <p className="text-sm text-[#6b7280]">{reveal.architect_contact}</p>
                  )}
                  {reveal.architect_website && (
                    <a
                      href={reveal.architect_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#2563eb] hover:text-[#1d4ed8] break-all"
                    >
                      {reveal.architect_website}
                    </a>
                  )}
                  {reveal.source_url && (
                    <a
                      href={reveal.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs text-[#9ca3af] hover:text-[#6b7280] mt-1"
                    >
                      View permit filing ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All listings sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
