import { redirect } from 'next/navigation'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { fetchCityList, fetchListPurchase, resolveUserByHash } from '@/lib/queries'
import { formatPrice } from '@/lib/format'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import BuyButton from './BuyButton'

interface ListPageProps {
  params: Promise<{ hash: string; city: string }>
}

export default async function ListPage({ params }: ListPageProps) {
  const { hash, city } = await params
  const supabase = createSupabaseServiceClient()

  const [userResult, cityListResult] = await Promise.all([
    resolveUserByHash(supabase, hash),
    fetchCityList(supabase, city),
  ])

  if (userResult.error || !userResult.user) {
    return (
      <ErrorShell message="This link isn't valid. Check your email for the correct URL." />
    )
  }
  const user = userResult.user

  if (cityListResult.error || !cityListResult.cityList) {
    return <ErrorShell message="This report isn't available right now." />
  }
  const cityList = cityListResult.cityList

  const { purchase } = await fetchListPurchase(supabase, user.id, cityList.id)
  if (purchase) {
    redirect(`/list/${hash}/${city}/success`)
  }

  const launchPrice = cityList.price_cents
  const anchorPrice = cityList.anchor_price_cents
  const hasDiscount = anchorPrice !== null && launchPrice < anchorPrice

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1">
        <section className="mb-10" data-testid="list-hero">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent mb-3">
            City market structure report · {cityList.year}
          </p>
          <h1 className="font-serif text-[32px] md:text-[44px] font-semibold leading-tight tracking-tight mb-4">
            {cityList.title}
          </h1>
          {cityList.description && (
            <p className="font-mono text-[13px] text-ink leading-relaxed whitespace-pre-line">
              {cityList.description}
            </p>
          )}
        </section>

        {cityList.headline_insight && (
          <section className="mb-10" data-testid="list-insight">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
              One thing you&apos;ll know after reading
            </h2>
            <blockquote className="bg-paper border-l-4 border-accent px-5 py-4">
              <p className="font-serif text-[20px] font-semibold leading-snug">
                {cityList.headline_insight}
              </p>
              {cityList.headline_insight_subtext && (
                <p className="font-mono text-[12px] text-muted mt-3 leading-relaxed">
                  {cityList.headline_insight_subtext}
                </p>
              )}
            </blockquote>
          </section>
        )}

        <section className="mb-10" data-testid="list-toc">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            What&apos;s in the report
          </h2>
          <div className="border border-ink">
            {[
              {
                num: '01',
                title: 'Three-tier market overview',
                body: '621 permits split across ADU, SFR, Multifamily — counts and area share for each.',
              },
              {
                num: '02',
                title: 'ADU — high-frequency B2C, geo plays',
                body: '516 ADUs, 96% single-owner. Top 10 zip codes ranked. Why the only scalable channel is local SEO + yard signs.',
              },
              {
                num: '03',
                title: 'SFR — the “fake free market”',
                body: '71 SFR permits, 75% in 6 LLCs. Names of every multi-property owner + total square footage held.',
              },
              {
                num: '04',
                title: 'Multifamily — developer private market',
                body: '34 projects (19 apartment + 15 townhouse), top 5 developers hold 59%. Geographic clusters.',
              },
              {
                num: '05',
                title: 'GC playbook per tier',
                body: 'What to do with this information for each market segment.',
              },
            ].map((row, i, arr) => (
              <div
                key={row.num}
                className={`px-5 py-4 grid grid-cols-[32px_1fr] gap-3 ${i === arr.length - 1 ? '' : 'border-b border-ink'}`}
              >
                <span className="font-mono text-[11px] text-accent tabular-nums">{row.num}</span>
                <div>
                  <p className="font-serif text-[16px] font-semibold mb-1">{row.title}</p>
                  <p className="font-mono text-[12px] text-muted leading-relaxed">{row.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10" data-testid="list-samples">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            Sample data from the report
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SampleStat
              testId="sample-chart-1"
              label="ADU volume by quarter"
              value="70 → 151"
              detail="2025-Q1 to 2026-Q1, +116% YoY"
            />
            <SampleStat
              testId="sample-chart-2"
              label="SFR owner concentration"
              value="75% / 6 LLCs"
              detail="Of 71 permits, 53 are owned by 6 entities"
            />
            <SampleStat
              testId="sample-chart-3"
              label="Multifamily top owner"
              value="Seely · 7"
              detail="Apt + Townhouse, 20.6% of all multifamily"
            />
          </div>
        </section>

        <section className="mb-10 border border-ink p-6" data-testid="list-cta">
          <div className="flex items-baseline gap-3 mb-3 flex-wrap">
            {hasDiscount && (
              <span
                className="font-mono text-[14px] text-muted line-through tabular-nums"
                data-testid="anchor-price"
              >
                {formatPrice(anchorPrice)}
              </span>
            )}
            <span
              className="font-serif text-[36px] md:text-[44px] font-semibold tabular-nums leading-none"
              data-testid="launch-price"
            >
              {formatPrice(launchPrice)}
            </span>
            {hasDiscount && (
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                Launch price
              </span>
            )}
          </div>
          <p className="font-mono text-[13px] text-muted mb-5 leading-relaxed">
            One-time purchase. Instant download after payment. PDF format, ~15 pages, designed to
            be read on phone in 5 minutes.
          </p>
          <BuyButton hash={hash} city={city} />
          <p className="font-mono text-[11px] text-muted mt-3">
            Secure checkout via Stripe. Refund on request within 7 days of purchase.
          </p>
        </section>

        <section className="mb-10" data-testid="list-faq">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
            Common questions
          </h2>
          <div className="space-y-5">
            {[
              {
                q: 'How is this different from buying a lead list?',
                a: 'A lead list gives you names. This shows you the structure — who owns the pipeline, who actually decides, where to spend your time. A list without targeting is a waste of money. This is the targeting.',
              },
              {
                q: 'How current is the data?',
                a: 'Built from 621 permits filed January 2025 through April 2026. Data sourced from public planning commission filings.',
              },
              {
                q: "What if it doesn't apply to my work?",
                a: 'Refund within 7 days of purchase, no questions. Email the address on your Stripe receipt.',
              },
            ].map((qa, i) => (
              <div key={i}>
                <p className="font-serif text-[16px] font-semibold mb-1">{qa.q}</p>
                <p className="font-mono text-[12px] text-muted leading-relaxed">{qa.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function SampleStat({ testId, label, value, detail }: { testId: string; label: string; value: string; detail: string }) {
  return (
    <div className="border border-ink p-4" data-testid={testId}>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted mb-2">{label}</p>
      <p className="font-serif text-[22px] font-semibold tabular-nums leading-tight">{value}</p>
      <p className="font-mono text-[11px] text-muted mt-1 leading-relaxed">{detail}</p>
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
