import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { fetchCityList, fetchListPurchase, resolveUserByHash } from '@/lib/queries'
import { formatDate } from '@/lib/format'
import DownloadButton from './DownloadButton'

interface SuccessPageProps {
  params: Promise<{ hash: string; city: string }>
}

export default async function ListSuccessPage({ params }: SuccessPageProps) {
  const { hash, city } = await params
  const supabase = createSupabaseServiceClient()

  // Validate hash + look up city in parallel.
  const [userResult, cityListResult] = await Promise.all([
    resolveUserByHash(supabase, hash),
    fetchCityList(supabase, city),
  ])

  if (userResult.error || !userResult.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <p className="text-base text-[#6b7280]">
          This link isn&apos;t valid. Check your email for the correct URL.
        </p>
      </div>
    )
  }
  const user = userResult.user

  if (cityListResult.error || !cityListResult.cityList) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f5]">
        <p className="text-base text-[#6b7280]">
          This report isn&apos;t available right now.
        </p>
      </div>
    )
  }
  const cityList = cityListResult.cityList

  // Not purchased? Send back to landing page.
  const { purchase } = await fetchListPurchase(supabase, user.id, cityList.id)
  if (!purchase) {
    redirect(`/list/${hash}/${city}`)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <section className="mb-8" data-testid="purchase-confirmation">
          <p className="text-xs uppercase tracking-wider font-semibold text-[#16a34a] mb-2">
            Purchase confirmed
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-3">
            {cityList.title}
          </h1>
          <p className="text-sm text-[#6b7280]">
            Purchased {formatDate(purchase.purchased_at)}. This page works as your
            permanent download link — bookmark it.
          </p>
        </section>

        <section className="mb-10 bg-white border border-gray-200 rounded-md p-6">
          <h2 className="text-base font-semibold text-[#111827] mb-3">
            Download the report
          </h2>
          <p className="text-sm text-[#6b7280] mb-5">
            Click below to generate a fresh download link. Each link is valid for
            two hours. You can come back to this page any time to generate a new one.
          </p>
          <DownloadButton hash={hash} city={city} />
        </section>

        <section className="mb-10" data-testid="next-steps">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
            What to do next
          </h2>
          <ol className="space-y-3 list-decimal pl-5 text-sm text-[#374151] leading-relaxed">
            <li>Read the report once on your phone — 5 minutes is enough for the structural takeaways.</li>
            <li>Pick the tier (ADU / SFR / Multifamily) closest to the work you want this year.</li>
            <li>Pull the named developer or owner LLCs from that section. Look up their websites and existing GC relationships.</li>
            <li>Send 5 cold emails this week. Reference a specific project of theirs from the report.</li>
          </ol>
        </section>
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All data sourced from public planning commission filings.
        </p>
      </footer>
    </div>
  )
}
