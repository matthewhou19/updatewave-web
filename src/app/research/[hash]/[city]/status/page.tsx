import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  fetchResearchPurchase,
  resolveUserByHash,
} from '@/lib/queries'
import { formatDate } from '@/lib/format'
import type { CityList } from '@/lib/types'
import DownloadButton from './DownloadButton'

interface StatusPageProps {
  params: Promise<{ hash: string; city: string }>
}

/**
 * /research/[hash]/[city]/status — combined success + status SSR page per
 * design Locked Decision #16.
 *
 * Renders one of three states based on research_purchases.delivery_status:
 *   'delivered'  → download button + digest cadence message
 *   'pending'    → "Research starts now. PDF in 5-10 days." (not used for
 *                   v1 SJ-only since SJ auto-delivers, but rendered for
 *                   future cities with non-null delivery_window_days)
 *   'in_research' → same shape as pending (work in progress)
 *   'cancelled'  → refund confirmation message
 *
 * Authorization: hash must resolve to a non-deleted user, and the user must
 * own a research_purchases row for this city. If not (invalid hash, soft-
 * deleted user, never purchased), returns 404 to avoid leaking ownership state.
 *
 * Bookmarkable: this is the canonical status page after Stripe Checkout
 * redirects via success_url, AND the page the customer comes back to later.
 * Stays fresh on server reload (no client polling per Locked Decision #16).
 */
export default async function ResearchStatusPage({ params }: StatusPageProps) {
  const { hash, city } = await params
  const supabase = createSupabaseServiceClient()

  const userResult = await resolveUserByHash(supabase, hash)
  if (userResult.error || !userResult.user) {
    // Invalid hash → 404 (don't tell the user the hash is bad on a status
    // page; if they got here from Stripe success_url with a bad hash that's
    // a real bug worth investigating; for cold visitors a 404 is safer
    // than leaking purchase state).
    notFound()
  }
  const user = userResult.user

  // Look up the research-tier city_list (filter explicitly to avoid the
  // ambiguous (city, year) match after migration 004).
  const cityList = await fetchResearchCityListBySlug(supabase, city)
  if (!cityList) {
    notFound()
  }

  const { purchase } = await fetchResearchPurchase(supabase, user.id, cityList.id)
  if (!purchase) {
    // No purchase → 404 (per design: don't leak existence vs. "not yours").
    notFound()
  }

  const status = purchase.delivery_status

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <section className="mb-8" data-testid="research-status-header">
          <p
            className={`text-xs uppercase tracking-wider font-semibold mb-2 ${
              status === 'delivered'
                ? 'text-[#16a34a]'
                : status === 'cancelled'
                  ? 'text-[#dc2626]'
                  : 'text-[#2563eb]'
            }`}
            data-testid="status-eyebrow"
          >
            {status === 'delivered' && 'Research delivered'}
            {(status === 'pending' || status === 'in_research') &&
              'Research in progress'}
            {status === 'cancelled' && 'Refund confirmed'}
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-3">
            {cityList.title}
          </h1>
          <p className="text-sm text-[#6b7280]">
            Purchased {formatDate(purchase.purchased_at)}. Bookmark this page
            — it&apos;s your permanent status + download link.
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
          <PendingSection
            deliveryWindowDays={cityList.delivery_window_days}
          />
        )}

        {status === 'cancelled' && <CancelledSection />}
      </main>

      <footer className="max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-[#9ca3af]">
          All data sourced from public planning commission filings.
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

interface DeliveredSectionProps {
  hash: string
  city: string
  deliveredAt: string | null
  digestUntil: string
}

function DeliveredSection({
  hash,
  city,
  deliveredAt,
  digestUntil,
}: DeliveredSectionProps) {
  return (
    <>
      <section
        className="mb-10 bg-white border border-gray-200 rounded-md p-6"
        data-testid="research-delivered"
      >
        <h2 className="text-base font-semibold text-[#111827] mb-3">
          Download your research PDF
        </h2>
        <p className="text-sm text-[#6b7280] mb-5">
          Click below to generate a fresh download link. Each link is valid
          for two hours. Come back to this page any time to generate a new one.
          {deliveredAt && (
            <>
              {' '}
              Delivered {formatDate(deliveredAt)}.
            </>
          )}
        </p>
        <DownloadButton hash={hash} city={city} />
      </section>

      <section className="mb-10" data-testid="research-digest-info">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
          Your weekly digest
        </h2>
        <div className="bg-white border border-gray-200 rounded-md p-5">
          <p className="text-sm text-[#374151] leading-relaxed">
            Your weekly digest emails will start within 7 days. Sent from
            matthew@updatewave.com. The digest covers every notable new permit
            filed in your city, with founder commentary on what each one means
            for your GC business.
          </p>
          <p className="text-xs text-[#6b7280] mt-3">
            Digest active through {formatDate(digestUntil)} (90 days from
            purchase).
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
  // For instant SKUs deliveryWindowDays is NULL — but if we land here with
  // status='pending' on an instant SKU, that means the auto-flip in the
  // webhook didn't execute (e.g. the row was inserted by some other path).
  // Show a generic 5-10 day window in that case.
  const windowText =
    deliveryWindowDays && deliveryWindowDays > 0
      ? `${deliveryWindowDays} days`
      : '5 to 10 days'

  return (
    <section
      className="mb-10 bg-white border border-gray-200 rounded-md p-6"
      data-testid="research-pending"
    >
      <h2 className="text-base font-semibold text-[#111827] mb-3">
        Research starts now
      </h2>
      <p className="text-sm text-[#374151] leading-relaxed mb-3">
        We received your payment and are pulling the permit data for your city.
        Your custom research PDF will arrive in {windowText}. We&apos;ll email
        you the moment it&apos;s ready.
      </p>
      <p className="text-sm text-[#6b7280]">
        Your 90-day weekly digest also starts now — first digest within 7 days
        of purchase.
      </p>
    </section>
  )
}

function CancelledSection() {
  return (
    <section
      className="mb-10 bg-white border border-gray-200 rounded-md p-6"
      data-testid="research-cancelled"
    >
      <h2 className="text-base font-semibold text-[#111827] mb-3">
        Refund processed
      </h2>
      <p className="text-sm text-[#374151] leading-relaxed">
        Your purchase was cancelled and a full refund has been issued. The
        money should appear back on your statement within 5-10 business days.
        If you have questions, email matthew@updatewave.com.
      </p>
    </section>
  )
}

/**
 * Look up an active research-tier city_list row by slug.
 *
 * Same disambiguation as the API routes — needed because migration 004
 * lets SJ have both a 'report' and 'research' row.
 */
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
