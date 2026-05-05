import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  fetchActiveResearchCities,
  fetchCityList,
  fetchListPurchaseForCollisionCheck,
  resolveUserByHash,
} from '@/lib/queries'
import { formatPrice } from '@/lib/format'
import CitySelectorWithBuy from './CitySelectorWithBuy'

interface ResearchPageProps {
  params: Promise<{ hash: string }>
}

/**
 * /research/[hash] — landing page for the $1,999 Custom Research +
 * 90-Day Monitoring SKU.
 *
 * Mirrors /list/[hash]/[city] structure (sticky header, hero, killer insight,
 * TOC, CTA, FAQ, footer). Container max-w-3xl mx-auto px-4.
 *
 * Differences from /list:
 *   - City is selected from a dropdown (vs. URL slug). For v1, only SJ is
 *     offered (one option) — dropdown rendered for forward-compat.
 *   - Per design Locked Decision #20: if the user already owns the $349 SJ
 *     report, render a yellow collision callout below the dropdown.
 *   - Price block: $1,999 with no anchor strikethrough (it IS the anchor).
 *   - "What's included" mentions the 12-month historical PDF + 90-day weekly
 *     digest with founder commentary.
 *
 * Hash is the only auth surface. Invalid hash → friendly error message.
 */
export default async function ResearchPage({ params }: ResearchPageProps) {
  const { hash } = await params
  const supabase = createSupabaseServiceClient()

  // Validate hash + fetch active research cities in parallel.
  const [userResult, citiesResult] = await Promise.all([
    resolveUserByHash(supabase, hash),
    fetchActiveResearchCities(supabase),
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

  const cities = citiesResult.cityLists ?? []

  // Per-city collision check: for any research city, find out whether the
  // user owns the corresponding $349 list_purchases row (matched by city,
  // ignoring tier — we want to know if the user already has any non-research
  // SKU for this city). For v1 the only relevant collision is SJ.
  //
  // Implementation: look up the report-tier city_list for each city slug, then
  // call fetchListPurchaseForCollisionCheck against its id. We do this in
  // parallel to keep the page render snappy.
  const collisionFlags = await Promise.all(
    cities.map(async (cityRow) => {
      const { cityList: reportRow } = await fetchCityList(supabase, cityRow.city)
      if (!reportRow) {
        return { slug: cityRow.city, ownsExistingReport: false }
      }
      const { owns } = await fetchListPurchaseForCollisionCheck(
        supabase,
        user.id,
        reportRow.id
      )
      return { slug: cityRow.city, ownsExistingReport: owns }
    })
  )
  const collisionMap = new Map(
    collisionFlags.map((c) => [c.slug, c.ownsExistingReport])
  )

  const cityOptions = cities.map((c) => ({
    slug: c.city,
    // Use the city_lists.title as the dropdown label. For SJ this is
    // "San Jose 2025 Custom Research + 90-Day Permit Monitoring". To keep
    // the dropdown readable, prefer a shorter label if we can derive one,
    // otherwise fall back to the title.
    label: shortCityLabel(c.title, c.city, c.year),
    ownsExistingReport: collisionMap.get(c.city) ?? false,
  }))

  // For v1 the $1,999 price is the same across cities (research is a
  // standardized SKU). Read it from the first city row; if no cities are
  // active, fall back to a hardcoded display string.
  const priceCents = cities[0]?.price_cents ?? 199900

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <section className="mb-10" data-testid="research-hero">
          <p className="text-xs uppercase tracking-wider font-semibold text-[#2563eb] mb-2">
            Custom research · for your Bay Area city
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-4">
            Custom city research + 90-day permit monitoring
          </h1>
          <p className="text-base text-[#374151] leading-relaxed">
            Pick any Bay Area city we cover. We deliver the same market structure
            analysis our $349 San Jose customers love — plus 90 days of
            weekly permit-monitoring digests, hand-curated by Matthew, so you&apos;re
            first to act on new construction in your service area.
          </p>
        </section>

        {/* Killer insight blockquote */}
        <section className="mb-10" data-testid="research-insight">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
            One example of what you&apos;ll know
          </h2>
          <blockquote className="bg-white border-l-4 border-[#2563eb] px-5 py-4 rounded-r-md">
            <p className="text-[18px] font-bold text-[#111827] leading-snug">
              75% of San Jose SFR new construction is held by 6 multi-property
              owners. To win SFR work, contact the developers — not the
              architects, not the listed owners.
            </p>
            <p className="text-sm text-[#6b7280] mt-3">
              That single insight is from the SJ historical report. The
              monitoring add-on tells you the day a 7th LLC files its first
              project — usually weeks before your competitors notice.
            </p>
          </blockquote>
        </section>

        {/* What's included */}
        <section className="mb-10" data-testid="research-toc">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
            What&apos;s included
          </h2>
          <div className="bg-white border border-gray-200 rounded-md divide-y divide-gray-100">
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">
                01
              </span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  12-month historical market structure PDF
                </p>
                <p className="text-xs text-[#6b7280]">
                  ~15 pages. Tier breakdown (ADU / SFR / Multifamily), owner
                  concentration, who actually decides at each tier, and the GC
                  playbook for each segment. Same format as the $349 SJ report.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">
                02
              </span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  Weekly permit digests for 90 days
                </p>
                <p className="text-xs text-[#6b7280]">
                  Every notable new permit filed in your city, hand-picked and
                  annotated with founder commentary. Not auto-generated — you
                  get the &ldquo;why this matters for your business&rdquo;
                  alongside the data.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">
                03
              </span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  Owner + developer contact strategy notes
                </p>
                <p className="text-xs text-[#6b7280]">
                  Per-tier playbook so you don&apos;t waste cold outreach on
                  low-leverage targets. Includes scripts and timing windows that
                  worked for our SJ customers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Price + city selector + CTA */}
        <section
          className="mb-10 bg-white border border-gray-200 rounded-md p-6"
          data-testid="research-cta"
        >
          <div className="mb-5">
            <span
              className="text-[32px] font-bold text-[#111827] tabular-nums"
              data-testid="launch-price"
            >
              {formatPrice(priceCents)}
            </span>
            <p className="text-sm text-[#6b7280] mt-2">
              One-time purchase. For San Jose, instant download — same PDF
              that customers pay $349 for, plus the 90-day monitoring stream
              starts immediately.
            </p>
          </div>

          <CitySelectorWithBuy hash={hash} cities={cityOptions} />

          <p className="text-xs text-[#9ca3af] mt-4">
            Secure checkout via Stripe. The 90-day monitoring window starts
            from your purchase date.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-10" data-testid="research-faq">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-4">
            Common questions
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                How is this different from the $349 city report?
              </p>
              <p className="text-sm text-[#6b7280] mt-1">
                The $349 report is a one-time historical PDF — what happened
                in your city over the past 12 months. The $1,999 research adds
                90 days of forward-looking permit monitoring on top, so you&apos;re
                not just reading history, you&apos;re acting on new filings as
                they happen.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                What cities do you cover?
              </p>
              <p className="text-sm text-[#6b7280] mt-1">
                For launch, we deliver instant research for San Jose. Other Bay
                Area cities will be added as we build per-city permit data.
                Email matthew@updatewave.com if your city isn&apos;t listed
                yet — we prioritize by demand.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                Who writes the weekly digests?
              </p>
              <p className="text-sm text-[#6b7280] mt-1">
                Matthew (founder) hand-picks notable permits each week and
                writes the commentary. You&apos;re not getting an LLM
                summarizer — you&apos;re getting opinionated GC-business
                analysis from someone who reads every filing.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">
                What if I already bought the $349 SJ report?
              </p>
              <p className="text-sm text-[#6b7280] mt-1">
                The dropdown above will show a yellow notice. The $1,999
                purchase covers the same PDF you already have plus the 90-day
                monitoring add-on. Buying the $1,999 closes the 7-day refund
                window on your existing $349 receipt — email
                matthew@updatewave.com first if you&apos;d rather upgrade with
                a credit applied.
              </p>
            </div>
          </div>
        </section>
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

/**
 * Build a short, scannable label for the city dropdown.
 *
 * city_lists.title is marketing copy ("San Jose 2025 Custom Research + 90-Day
 * Permit Monitoring") which is too long for a dropdown option. Generate a
 * short version like "San Jose 2025" by capitalizing the slug.
 *
 * Falls back to the title if the slug-based label can't be built (defensive).
 */
function shortCityLabel(title: string, slug: string, year: number): string {
  // Map known short city slugs to display names. Keep this list small — when
  // a new city ships its slug should be added here. Any unmatched slug falls
  // back to the title verbatim.
  const slugToCity: Record<string, string> = {
    sj: 'San Jose',
    sf: 'San Francisco',
    fremont: 'Fremont',
    oakland: 'Oakland',
  }
  const cityName = slugToCity[slug]
  if (!cityName) return title
  return `${cityName} ${year}`
}
