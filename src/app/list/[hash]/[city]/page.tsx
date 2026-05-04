import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { fetchCityList, fetchListPurchase, resolveUserByHash } from '@/lib/queries'
import { formatPrice } from '@/lib/format'
import BuyButton from './BuyButton'

interface ListPageProps {
  params: Promise<{ hash: string; city: string }>
}

export default async function ListPage({ params }: ListPageProps) {
  const { hash, city } = await params
  const supabase = createSupabaseServiceClient()

  // Validate hash + look up city in parallel (both depend only on URL params).
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

  // Already purchased? Skip to success/download.
  const { purchase } = await fetchListPurchase(supabase, user.id, cityList.id)
  if (purchase) {
    redirect(`/list/${hash}/${city}/success`)
  }

  const launchPrice = cityList.price_cents
  const anchorPrice = cityList.anchor_price_cents
  const hasDiscount = anchorPrice !== null && launchPrice < anchorPrice

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center">
          <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Hero */}
        <section className="mb-10" data-testid="list-hero">
          <p className="text-xs uppercase tracking-wider font-semibold text-[#2563eb] mb-2">
            City market structure report · {cityList.year}
          </p>
          <h1 className="text-[28px] sm:text-[32px] font-bold text-[#111827] leading-tight mb-4">
            {cityList.title}
          </h1>
          {cityList.description && (
            <p className="text-base text-[#374151] leading-relaxed whitespace-pre-line">
              {cityList.description}
            </p>
          )}
        </section>

        {/* Killer insight (the one sentence that justifies the price) */}
        {cityList.headline_insight && (
          <section className="mb-10" data-testid="list-insight">
            <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
              One thing you&apos;ll know after reading
            </h2>
            <blockquote className="bg-white border-l-4 border-[#2563eb] px-5 py-4 rounded-r-md">
              <p className="text-[18px] font-bold text-[#111827] leading-snug">
                {cityList.headline_insight}
              </p>
              {cityList.headline_insight_subtext && (
                <p className="text-sm text-[#6b7280] mt-3">
                  {cityList.headline_insight_subtext}
                </p>
              )}
            </blockquote>
          </section>
        )}

        {/* What's in the report (TOC) */}
        <section className="mb-10" data-testid="list-toc">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
            What&apos;s in the report
          </h2>
          <div className="bg-white border border-gray-200 rounded-md divide-y divide-gray-100">
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">01</span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Three-tier market overview</p>
                <p className="text-xs text-[#6b7280]">621 permits split across ADU, SFR, Multifamily — counts and area share for each.</p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">02</span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">ADU — high-frequency B2C, geo plays</p>
                <p className="text-xs text-[#6b7280]">516 ADUs, 96% single-owner. Top 10 zip codes ranked. Why the only scalable channel is local SEO + yard signs.</p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">03</span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">SFR — the &ldquo;fake free market&rdquo;</p>
                <p className="text-xs text-[#6b7280]">71 SFR permits, 75% in 6 LLCs. Names of every multi-property owner + total square footage held.</p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">04</span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Multifamily — developer private market</p>
                <p className="text-xs text-[#6b7280]">34 projects (19 apartment + 15 townhouse), top 5 developers hold 59%. Geographic clusters.</p>
              </div>
            </div>
            <div className="px-5 py-3 flex items-baseline gap-3">
              <span className="text-xs font-semibold text-[#2563eb] tabular-nums w-6">05</span>
              <div>
                <p className="text-sm font-semibold text-[#111827]">GC playbook per tier</p>
                <p className="text-xs text-[#6b7280]">What to do with this information for each market segment.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Sample charts (3 textual previews of the visualizations in the report) */}
        <section className="mb-10" data-testid="list-samples">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-3">
            Sample data from the report
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-md p-4" data-testid="sample-chart-1">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">ADU volume by quarter</p>
              <p className="text-[20px] font-bold text-[#111827] tabular-nums">70 → 151</p>
              <p className="text-xs text-[#6b7280] mt-1">2025-Q1 to 2026-Q1, +116% YoY</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-4" data-testid="sample-chart-2">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">SFR owner concentration</p>
              <p className="text-[20px] font-bold text-[#111827] tabular-nums">75% / 6 LLCs</p>
              <p className="text-xs text-[#6b7280] mt-1">Of 71 permits, 53 are owned by 6 entities</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-4" data-testid="sample-chart-3">
              <p className="text-xs font-semibold text-[#6b7280] mb-2">Multifamily top owner</p>
              <p className="text-[20px] font-bold text-[#111827] tabular-nums">Seely · 7</p>
              <p className="text-xs text-[#6b7280] mt-1">Apt + Townhouse, 20.6% of all multifamily</p>
            </div>
          </div>
        </section>

        {/* Price + CTA */}
        <section
          className="mb-10 bg-white border border-gray-200 rounded-md p-6"
          data-testid="list-cta"
        >
          <div className="flex items-baseline gap-3 mb-4 flex-wrap">
            {hasDiscount && (
              <span
                className="text-base text-[#9ca3af] line-through tabular-nums"
                data-testid="anchor-price"
              >
                {formatPrice(anchorPrice)}
              </span>
            )}
            <span
              className="text-[32px] font-bold text-[#111827] tabular-nums"
              data-testid="launch-price"
            >
              {formatPrice(launchPrice)}
            </span>
            {hasDiscount && (
              <span className="text-xs uppercase tracking-wider font-semibold text-[#dc2626]">
                Launch price
              </span>
            )}
          </div>
          <p className="text-sm text-[#6b7280] mb-5">
            One-time purchase. Instant download after payment. PDF format,
            ~15 pages, designed to be read on phone in 5 minutes.
          </p>
          <BuyButton hash={hash} city={city} />
          <p className="text-xs text-[#9ca3af] mt-3">
            Secure checkout via Stripe. Refund on request within 7 days of purchase.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-10" data-testid="list-faq">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-[#6b7280] mb-4">
            Common questions
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[#111827]">How is this different from buying a lead list?</p>
              <p className="text-sm text-[#6b7280] mt-1">
                A lead list gives you names. This shows you the structure — who owns
                the pipeline, who actually decides, where to spend your time.
                A list without targeting is a waste of money. This is the targeting.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">How current is the data?</p>
              <p className="text-sm text-[#6b7280] mt-1">
                Built from 621 permits filed January 2025 through April 2026.
                Data sourced from public planning commission filings.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">What if it doesn&apos;t apply to my work?</p>
              <p className="text-sm text-[#6b7280] mt-1">
                Refund within 7 days of purchase, no questions. Email the address
                on your Stripe receipt.
              </p>
            </div>
          </div>
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
