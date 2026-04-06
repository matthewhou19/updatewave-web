import { createSupabaseClient } from '@/lib/supabase'
import { Project } from '@/lib/types'
import ProjectList from '@/components/ProjectList'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createSupabaseClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'published')
    .order('filing_date', { ascending: false })

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pt-6 pb-2">
        <h1 className="text-[22px] font-bold text-[#111827] mb-1">
          Pre-permit projects in your area
        </h1>
        <p className="text-sm text-[#6b7280]">
          New residential projects filed with the city — before permits are issued.
          Reveal architect contact info for $25.
        </p>
      </div>

      <ProjectList
        projects={(projects ?? []) as Project[]}
        revealedProjectIds={[]}
      />

      <footer className="max-w-6xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All listings sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
