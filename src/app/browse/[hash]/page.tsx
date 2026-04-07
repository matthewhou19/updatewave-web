import { createSupabaseServiceClient } from '@/lib/supabase'
import { User } from '@/lib/types'
import { fetchPublishedProjects, fetchUserByHash, fetchUserReveals, fetchArchitectData, mergeArchitectData } from '@/lib/queries'
import TopBar from '@/components/TopBar'
import ProjectList from '@/components/ProjectList'

interface BrowsePageProps {
  params: Promise<{ hash: string }>
}

export default async function BrowsePage({ params }: BrowsePageProps) {
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

  // Update last_seen_at (fire and forget, don't block render)
  void supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', typedUser.id)
    .then(() => {}, () => {})

  // Fetch projects + reveals + architect data using query helpers
  const { projects } = await fetchPublishedProjects(supabase)
  const { revealedProjectIds } = await fetchUserReveals(supabase, typedUser.id)
  const architectData = await fetchArchitectData(supabase, revealedProjectIds)
  const sanitizedProjects = mergeArchitectData(projects, architectData)

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
