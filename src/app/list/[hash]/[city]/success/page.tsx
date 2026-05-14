import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { fetchCityList, fetchListPurchase, resolveUserByHash } from '@/lib/queries'
import { formatDate } from '@/lib/format'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import DownloadButton from './DownloadButton'

interface SuccessPageProps {
  params: Promise<{ hash: string; city: string }>
}

export default async function ListSuccessPage({ params }: SuccessPageProps) {
  const { hash, city } = await params
  const supabase = createSupabaseServiceClient()

  const [userResult, cityListResult] = await Promise.all([
    resolveUserByHash(supabase, hash),
    fetchCityList(supabase, city),
  ])

  if (userResult.error || !userResult.user) {
    return <ErrorShell message="This link isn't valid. Check your email for the correct URL." />
  }
  const user = userResult.user

  if (cityListResult.error || !cityListResult.cityList) {
    return <ErrorShell message="This report isn't available right now." />
  }
  const cityList = cityListResult.cityList

  const { purchase } = await fetchListPurchase(supabase, user.id, cityList.id)
  if (!purchase) {
    redirect(`/list/${hash}/${city}`)
  }

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1">
        <section className="mb-8" data-testid="purchase-confirmation">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent mb-3">
            <span className="mr-1" aria-hidden>●</span>Purchase confirmed
          </p>
          <h1 className="font-serif text-[32px] md:text-[44px] font-semibold leading-tight tracking-tight mb-3">
            {cityList.title}
          </h1>
          <p className="font-mono text-[13px] text-muted">
            Purchased {formatDate(purchase.purchased_at)}. This page works as your permanent
            download link — bookmark it.
          </p>
        </section>

        <section className="mb-10 border border-ink p-6">
          <h2 className="font-serif text-[20px] font-semibold mb-3">Download the report</h2>
          <p className="font-mono text-[13px] text-muted mb-5 leading-relaxed">
            Click below to generate a fresh download link. Each link is valid for two hours. You
            can come back to this page any time to generate a new one.
          </p>
          <DownloadButton hash={hash} city={city} />
        </section>

        <section className="mb-10" data-testid="next-steps">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            What to do next
          </h2>
          <ol className="space-y-3 list-decimal pl-5 font-mono text-[13px] text-ink leading-relaxed marker:text-accent">
            <li>Read the report once on your phone — 5 minutes is enough for the structural takeaways.</li>
            <li>Pick the tier (ADU / SFR / Multifamily) closest to the work you want this year.</li>
            <li>
              Pull the named developer or owner LLCs from that section. Look up their websites and
              existing GC relationships.
            </li>
            <li>Send 5 cold emails this week. Reference a specific project of theirs from the report.</li>
          </ol>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function ErrorShell({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <p className="font-mono text-[14px] text-muted text-center max-w-md">{message}</p>
      </main>
    </div>
  )
}
