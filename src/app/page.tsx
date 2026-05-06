import Link from 'next/link'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchPublishedProjects } from '@/lib/queries'
import ProjectList from '@/components/ProjectList'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createSupabaseClient()

  const { projects } = await fetchPublishedProjects(supabase)

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
          <Link
            href="/login"
            className="text-sm text-[#2563eb] hover:text-[#1d4ed8] font-medium"
            data-testid="home-login-link"
          >
            Log in / Sign up →
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <h1 className="text-[22px] font-bold text-[#111827] mb-1">
          Pre-permit projects in your area
        </h1>
        <p className="text-sm text-[#6b7280] mb-4">
          New residential projects filed with the city — before permits are issued.
          Reveal architect contact info for $25.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-5 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-md transition-colors min-h-[40px]"
          data-testid="home-hero-cta"
        >
          Get started — free signup →
        </Link>
      </div>

      <ProjectList
        projects={projects}
        revealedProjectIds={[]}
      />

      <footer className="max-w-6xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All listings sourced from public planning commission filings.
        </p>
        <Link
          href="/pricing"
          className="text-xs text-[#9ca3af] hover:text-[#6b7280] underline mt-2 inline-block"
        >
          See all plans
        </Link>
      </footer>
    </div>
  )
}
