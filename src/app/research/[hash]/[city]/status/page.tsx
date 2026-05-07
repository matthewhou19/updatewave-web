import { notFound } from 'next/navigation'
import { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { fetchResearchPurchase, resolveUserByHash } from '@/lib/queries'
import { formatDate } from '@/lib/format'
import type { CityList } from '@/lib/types'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import DownloadButton from './DownloadButton'

interface StatusPageProps {
  params: Promise<{ hash: string; city: string }>
}

export default async function ResearchStatusPage({ params }: StatusPageProps) {
  const { hash, city } = await params
  const supabase = createSupabaseServiceClient()

  const userResult = await resolveUserByHash(supabase, hash)
  if (userResult.error || !userResult.user) {
    notFound()
  }
  const user = userResult.user

  const cityList = await fetchResearchCityListBySlug(supabase, city)
  if (!cityList) {
    notFound()
  }

  const { purchase } = await fetchResearchPurchase(supabase, user.id, cityList.id)
  if (!purchase) {
    notFound()
  }

  const status = purchase.delivery_status

  const eyebrowMap = {
    delivered: { text: 'Research delivered', color: 'text-accent', dot: '●' },
    pending: { text: 'Research in progress', color: 'text-ink', dot: '○' },
    in_research: { text: 'Research in progress', color: 'text-ink', dot: '○' },
    cancelled: { text: 'Refund confirmed', color: 'text-muted line-through', dot: '✕' },
  } as const
  const eyebrow = eyebrowMap[status]

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1">
        <section className="mb-8" data-testid="research-status-header">
          <p
            className={`font-mono text-[11px] uppercase tracking-[0.15em] mb-3 ${eyebrow.color}`}
            data-testid="status-eyebrow"
          >
            <span className="mr-1" aria-hidden>{eyebrow.dot}</span>
            {eyebrow.text}
          </p>
          <h1 className="font-serif text-[32px] md:text-[44px] font-semibold leading-tight tracking-tight mb-3">
            {cityList.title}
          </h1>
          <p className="font-mono text-[13px] text-muted">
            Purchased {formatDate(purchase.purchased_at)}. Bookmark this page — it&apos;s your
            permanent status + download link.
          </p>
        </section>

        {status === 'delivered' && (
          <DeliveredSection
            hash={hash}
            city={city}
            deliveredAt={purchase.delivered_at}
            digestUntil={purchase.digest_subscription_until}
          />
        )}

        {(status === 'pending' || status === 'in_research') && (
          <PendingSection deliveryWindowDays={cityList.delivery_window_days} />
        )}

        {status === 'cancelled' && <CancelledSection />}
      </main>

      <Footer />
    </div>
  )
}

interface DeliveredSectionProps {
  hash: string
  city: string
  deliveredAt: string | null
  digestUntil: string
}

function DeliveredSection({ hash, city, deliveredAt, digestUntil }: DeliveredSectionProps) {
  return (
    <>
      <section className="mb-10 border border-ink p-6" data-testid="research-delivered">
        <h2 className="font-serif text-[20px] font-semibold mb-3">Download your research PDF</h2>
        <p className="font-mono text-[13px] text-muted mb-5 leading-relaxed">
          Click below to generate a fresh download link. Each link is valid for two hours. Come
          back to this page any time to generate a new one.
          {deliveredAt && <> Delivered {formatDate(deliveredAt)}.</>}
        </p>
        <DownloadButton hash={hash} city={city} />
      </section>

      <section className="mb-10" data-testid="research-digest-info">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
          Your weekly digest
        </h2>
        <div className="border border-ink p-5">
          <p className="font-mono text-[13px] text-ink leading-relaxed">
            Your weekly digest emails will start within 7 days. Sent from matthew@updatewave.com.
            The digest covers every notable new permit filed in your city, with founder commentary
            on what each one means for your GC business.
          </p>
          <p className="font-mono text-[11px] text-muted mt-3">
            Digest active through {formatDate(digestUntil)} (90 days from purchase).
          </p>
        </div>
      </section>
    </>
  )
}

interface PendingSectionProps {
  deliveryWindowDays: number | null
}

function PendingSection({ deliveryWindowDays }: PendingSectionProps) {
  const windowText =
    deliveryWindowDays && deliveryWindowDays > 0 ? `${deliveryWindowDays} days` : '5 to 10 days'

  return (
    <section className="mb-10 border border-ink p-6" data-testid="research-pending">
      <h2 className="font-serif text-[20px] font-semibold mb-3">Research starts now</h2>
      <p className="font-mono text-[13px] text-ink leading-relaxed mb-3">
        We received your payment and are pulling the permit data for your city. Your custom
        research PDF will arrive in {windowText}. We&apos;ll email you the moment it&apos;s ready.
      </p>
      <p className="font-mono text-[13px] text-muted leading-relaxed">
        Your 90-day weekly digest also starts now — first digest within 7 days of purchase.
      </p>
    </section>
  )
}

function CancelledSection() {
  return (
    <section className="mb-10 border border-ink p-6" data-testid="research-cancelled">
      <h2 className="font-serif text-[20px] font-semibold mb-3">Refund processed</h2>
      <p className="font-mono text-[13px] text-ink leading-relaxed">
        Your purchase was cancelled and a full refund has been issued. The money should appear back
        on your statement within 5-10 business days. If you have questions, email
        matthew@updatewave.com.
      </p>
    </section>
  )
}

async function fetchResearchCityListBySlug(
  supabase: SupabaseClient,
  city: string
): Promise<CityList | null> {
  const { data } = await supabase
    .from('city_lists')
    .select(
      'id, city, year, title, description, headline_insight, headline_insight_subtext, price_cents, anchor_price_cents, active, service_tier, delivery_window_days, created_at, updated_at'
    )
    .eq('city', city)
    .eq('active', true)
    .eq('service_tier', 'research')
    .maybeSingle()

  return (data as CityList | null) ?? null
}
