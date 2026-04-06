import { createSupabaseServiceClient } from '@/lib/supabase'
import { Project, User } from '@/lib/types'
import TopBar from '@/components/TopBar'
import ProjectList from '@/components/ProjectList'

interface BrowsePageProps {
  params: Promise<{ hash: string }>
}

export default async function BrowsePage({ params }: BrowsePageProps) {
  const { hash } = await params
  const supabase = createSupabaseServiceClient()

  // Validate hash
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('hash', hash)
    .single()

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

  // Update last_seen_at (fire and forget, don't block render)
  supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', typedUser.id)
    .then(() => {})

  // Fetch published projects — explicit columns, architect fields excluded.
  // Architect data is added back below only for revealed projects.
  const { data: projects } = await supabase
    .from('projects')
    .select('id, city, address, project_type, estimated_value_cents, estimated_value, filing_date, source_url, status, reveal_count, published_at, updated_at, created_at')
    .eq('status', 'published')
    .order('filing_date', { ascending: false })

  // Fetch this user's reveals
  const { data: reveals } = await supabase
    .from('reveals')
    .select('project_id')
    .eq('user_id', typedUser.id)

  const revealedProjectIds = (reveals ?? []).map((r: { project_id: number }) => r.project_id)

  // Fetch architect data only for revealed projects (defense-in-depth:
  // architect columns are never fetched for unrevealed projects)
  let architectData: Record<number, { architect_name: string | null; architect_firm: string | null; architect_contact: string | null; architect_website: string | null }> = {}
  if (revealedProjectIds.length > 0) {
    const { data: revealedProjects } = await supabase
      .from('projects')
      .select('id, architect_name, architect_firm, architect_contact, architect_website')
      .in('id', revealedProjectIds)

    for (const rp of revealedProjects ?? []) {
      architectData[rp.id] = {
        architect_name: rp.architect_name,
        architect_firm: rp.architect_firm,
        architect_contact: rp.architect_contact,
        architect_website: rp.architect_website,
      }
    }
  }

  // Merge: revealed projects get architect data, unrevealed get nulls
  const sanitizedProjects = (projects ?? []).map((p) => {
    const project = p as Project
    const arch = architectData[project.id]
    return {
      ...project,
      architect_name: arch?.architect_name ?? null,
      architect_firm: arch?.architect_firm ?? null,
      architect_contact: arch?.architect_contact ?? null,
      architect_website: arch?.architect_website ?? null,
    }
  })

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <TopBar hash={hash} view="browse" />
      <ProjectList
        projects={sanitizedProjects}
        revealedProjectIds={revealedProjectIds}
        hash={hash}
      />
      <footer className="max-w-6xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All listings sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
