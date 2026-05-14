import { createSupabaseServiceClient } from '@/lib/supabase'
import {
  fetchActiveResearchCities,
  fetchCityList,
  fetchListPurchaseForCollisionCheck,
  resolveUserByHash,
} from '@/lib/queries'
import { formatPrice } from '@/lib/format'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import CitySelectorWithBuy from './CitySelectorWithBuy'

interface ResearchPageProps {
  params: Promise<{ hash: string }>
}

export default async function ResearchPage({ params }: ResearchPageProps) {
  const { hash } = await params
  const supabase = createSupabaseServiceClient()

  const [userResult, citiesResult] = await Promise.all([
    resolveUserByHash(supabase, hash),
    fetchActiveResearchCities(supabase),
  ])

  if (userResult.error || !userResult.user) {
    return <ErrorShell message="This link isn't valid. Check your email for the correct URL." />
  }
  const user = userResult.user

  const cities = citiesResult.cityLists ?? []

  const collisionFlags = await Promise.all(
    cities.map(async (cityRow) => {
      const { cityList: reportRow } = await fetchCityList(supabase, cityRow.city)
      if (!reportRow) {
        return { slug: cityRow.city, ownsExistingReport: false }
      }
      const { owns } = await fetchListPurchaseForCollisionCheck(supabase, user.id, reportRow.id)
      return { slug: cityRow.city, ownsExistingReport: owns }
    })
  )
  const collisionMap = new Map(collisionFlags.map((c) => [c.slug, c.ownsExistingReport]))

  const cityOptions = cities.map((c) => ({
    slug: c.city,
    label: shortCityLabel(c.title, c.city, c.year),
    ownsExistingReport: collisionMap.get(c.city) ?? false,
  }))

  const priceCents = cities[0]?.price_cents ?? 199900

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1">
        <section className="mb-10" data-testid="research-hero">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent mb-3">
            Custom research · for your Bay Area city
          </p>
          <h1 className="font-serif text-[32px] md:text-[44px] font-semibold leading-tight tracking-tight mb-4">
            Custom city research + 90-day permit monitoring
          </h1>
          <p className="font-mono text-[13px] text-ink leading-relaxed">
            Pick any Bay Area city we cover. We deliver the same market structure analysis our $499
            San Jose customers love — plus 90 days of weekly permit-monitoring digests, hand-curated
            by Matthew, so you&apos;re first to act on new construction in your service area.
          </p>
        </section>

        <section className="mb-10" data-testid="research-insight">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            One example of what you&apos;ll know
          </h2>
          <blockquote className="bg-paper border-l-4 border-accent px-5 py-4">
            <p className="font-serif text-[20px] font-semibold leading-snug">
              75% of San Jose SFR new construction is held by 6 multi-property owners. To win SFR
              work, contact the developers — not the architects, not the listed owners.
            </p>
            <p className="font-mono text-[12px] text-muted mt-3 leading-relaxed">
              That single insight is from the SJ historical report. The monitoring add-on tells you
              the day a 7th LLC files its first project — usually weeks before your competitors
              notice.
            </p>
          </blockquote>
        </section>

        <section className="mb-10" data-testid="research-toc">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            What&apos;s included
          </h2>
          <div className="border border-ink">
            {[
              {
                num: '01',
                title: '12-month historical market structure PDF',
                body: '~15 pages. Tier breakdown (ADU / SFR / Multifamily), owner concentration, who actually decides at each tier, and the GC playbook for each segment. Same format as the $499 SJ report.',
              },
              {
                num: '02',
                title: 'Weekly permit digests for 90 days',
                body: 'Every notable new permit filed in your city, hand-picked and annotated with founder commentary. Not auto-generated — you get the “why this matters for your business” alongside the data.',
              },
              {
                num: '03',
                title: 'Owner + developer contact strategy notes',
                body: "Per-tier playbook so you don't waste cold outreach on low-leverage targets. Includes scripts and timing windows that worked for our SJ customers.",
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

        <section className="mb-10 border border-ink p-6" data-testid="research-cta">
          <div className="mb-5">
            <span
              className="font-serif text-[36px] md:text-[44px] font-semibold tabular-nums leading-none"
              data-testid="launch-price"
            >
              {formatPrice(priceCents)}
            </span>
            <p className="font-mono text-[13px] text-muted mt-3 leading-relaxed">
              One-time purchase. For San Jose, instant download — same PDF that customers pay $499
              for, plus the 90-day monitoring stream starts immediately.
            </p>
          </div>

          <CitySelectorWithBuy hash={hash} cities={cityOptions} />

          <p className="font-mono text-[11px] text-muted mt-4">
            Secure checkout via Stripe. The 90-day monitoring window starts from your purchase date.
          </p>
        </section>

        <section className="mb-10" data-testid="research-faq">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
            Common questions
          </h2>
          <div className="space-y-5">
            {[
              {
                q: 'How is this different from the $499 city report?',
                a: 'The $499 report is a one-time historical PDF — what happened in your city over the past 12 months. The $1,999 research adds 90 days of forward-looking permit monitoring on top, so you’re not just reading history, you’re acting on new filings as they happen.',
              },
              {
                q: 'What cities do you cover?',
                a: 'For launch, we deliver instant research for San Jose. Other Bay Area cities will be added as we build per-city permit data. Email matthew@updatewave.com if your city isn’t listed yet — we prioritize by demand.',
              },
              {
                q: 'Who writes the weekly digests?',
                a: 'Matthew (founder) hand-picks notable permits each week and writes the commentary. You’re not getting an LLM summarizer — you’re getting opinionated GC-business analysis from someone who reads every filing.',
              },
              {
                q: 'What if I already bought the $499 SJ report?',
                a: 'The dropdown above will show a yellow notice. The $1,999 purchase covers the same PDF you already have plus the 90-day monitoring add-on. Buying the $1,999 closes the 7-day refund window on your existing $499 receipt — email matthew@updatewave.com first if you’d rather upgrade with a credit applied.',
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

function shortCityLabel(title: string, slug: string, year: number): string {
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
