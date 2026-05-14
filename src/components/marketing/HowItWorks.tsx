interface Step {
  num: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    num: 'STEP 01',
    title: 'We pull every permit.',
    body: 'A year of public planning commission filings for your city — addresses, owners, project types, square footage, dates. Raw data nobody bothers to structure.',
  },
  {
    num: 'STEP 02',
    title: 'AI maps the structure.',
    body: 'Owner concentration, repeat-buyer LLCs, ADU vs. SFR vs. multifamily split, geographic clusters, who actually decides at each tier. The structural picture under the noise.',
  },
  {
    num: 'STEP 03',
    title: 'You get a PDF you can act on.',
    body: 'Named LLCs. Per-tier playbooks. Read it on your phone in 5 minutes. Send your first targeted cold email this afternoon.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            From every raw permit to one PDF
            <br />
            you can actually use.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3">
            What we do for San Jose, we&apos;ll do for any Bay Area city you ask about.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 mt-12">
          {STEPS.map((step) => (
            <div key={step.num} className="border-t-2 border-ink pt-5">
              <div className="font-mono text-[11px] tracking-[0.15em] text-muted mb-3">{step.num}</div>
              <h3 className="font-serif text-[24px] md:text-[28px] font-semibold leading-tight tracking-tight mb-3">
                {step.title}
              </h3>
              <p className="font-mono text-[13px] leading-relaxed text-ink">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="font-mono text-[12px] text-muted mt-10 pt-4 border-t border-dashed border-grey-300 text-center">
          $499 for San Jose (instant) · $1,999 for any Bay Area city + 90 days monitoring · 7-day refund
        </p>
      </div>
    </section>
  )
}
