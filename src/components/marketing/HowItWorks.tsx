interface Step {
  num: string
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    num: 'STEP 01',
    title: 'Browse free.',
    body: 'Filter by city, project type, value range. See what was filed before anyone else — addresses partially redacted, descriptions visible.',
  },
  {
    num: 'STEP 02',
    title: 'Reveal what matters.',
    body: 'Unlock full address, owner name, and architect contact for $25 per lead. Pay only for the ones you actually want to chase.',
  },
  {
    num: 'STEP 03',
    title: 'Reach out first.',
    body: 'Beat the 6–12 GCs your competitors are still waiting for permits to find. Average lead time advantage: 47 days.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how" className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            A new lead arrives in San Jose
            <br />
            roughly every 4 hours.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3">
            Here&apos;s how you turn one into a contract.
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
          Unlocks are one-time · No subscription · Full refund if contact info is invalid or outdated
        </p>
      </div>
    </section>
  )
}
