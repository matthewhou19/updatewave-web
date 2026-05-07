import { createSupabaseServiceClient } from '@/lib/supabase'
import { User } from '@/lib/types'
import { fetchPublishedProjects, fetchUserByHash, fetchUserReveals, fetchArchitectData, mergeArchitectData } from '@/lib/queries'
import TopBar from '@/components/TopBar'
import ProjectList from '@/components/ProjectList'
import Footer from '@/components/marketing/Footer'

interface BrowsePageProps {
  params: Promise<{ hash: string }>
}

export default async function BrowsePage({ params }: BrowsePageProps) {
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

  // Update last_seen_at (fire and forget, don't block render)
  void supabase
    .from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', typedUser.id)
    .then(() => {}, () => {})

  const { projects } = await fetchPublishedProjects(supabase)
  const { revealedProjectIds } = await fetchUserReveals(supabase, typedUser.id)
  const architectData = await fetchArchitectData(supabase, revealedProjectIds)
  const sanitizedProjects = mergeArchitectData(projects, architectData)

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar hash={hash} view="browse" />
      <main className="flex-1">
        <ProjectList projects={sanitizedProjects} revealedProjectIds={revealedProjectIds} hash={hash} />
      </main>
      <Footer />
    </div>
  )
}
