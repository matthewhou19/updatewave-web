interface QA {
  q: string
  a: string
}

const QAS: QA[] = [
  {
    q: 'What does the report actually show me?',
    a: 'A 3-tier structural analysis (ADU, SFR, multifamily). For each tier: total permit count, owner concentration with named LLCs, top zip codes, and the GC playbook for that segment. Designed to read on phone in 5 minutes. See /sample for the table of contents and one redacted page.',
  },
  {
    q: 'Can\'t I just pull this data myself from the city?',
    a: 'You can. It\'ll take 30–40 hours to scrape the raw filings, deduplicate owners, classify project types, and produce something you can act on. Our $499 buys back those hours and the analysis layer on top — owner concentration, tier playbooks, named LLCs.',
  },
  {
    q: 'How is this different from BuildZoom or Dodge?',
    a: 'They sell post-permit lead lists on a $99–$300/mo subscription. We sell pre-permit structural analysis as a $499 one-time PDF. They tell you what just broke ground; we tell you which 6 owners decide what gets built next year.',
  },
  {
    q: "What if my city isn't San Jose?",
    a: 'The $1,999 custom research covers any Bay Area city you ask about. Same report format, plus 90 days of weekly permit monitoring with founder commentary. 5–10 day delivery for new cities; instant for SJ.',
  },
  {
    q: 'Who actually writes the analysis?',
    a: 'Matthew (founder) reviews every report. AI handles bulk extraction (parsing permit text, normalizing owner names) but the structural insight, naming, and per-tier playbooks are written by hand. Not LLM-summarized.',
  },
  {
    q: 'How current is the data?',
    a: 'For the SJ historical report: 12 months ending in the most recent complete quarter. For the $1,999 custom research: same historical window plus 90 days of forward-looking weekly digests on new permits as they file.',
  },
  {
    q: 'What\'s the refund policy?',
    a: '7-day no-questions refund on either product. Email matthew@updatewave.com with the receipt number. We\'d rather refund than have an unhappy customer.',
  },
  {
    q: 'Is this legal? Is this public information?',
    a: 'Yes. Every filing comes from public planning commission records — the same records anyone can request from the city. We just structure and analyze them. Architects can request listing removal at any time.',
  },
]

export default function FAQ() {
  return (
    <section className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            Questions GCs ask before buying the report.
          </h2>
        </div>
        <div className="border-t border-ink mt-12">
          {QAS.map((qa, i) => (
            <details key={i} className="border-b border-ink py-5 group">
              <summary className="grid grid-cols-[32px_1fr_24px] gap-4 items-start cursor-pointer list-none">
                <span className="font-mono text-[11px] text-muted pt-1">{String(i + 1).padStart(2, '0')}</span>
                <span className="font-serif text-[18px] md:text-[20px] font-semibold tracking-tight">
                  {qa.q}
                </span>
                <span
                  className="font-mono text-[18px] text-muted pt-0.5 group-open:rotate-45 transition-transform inline-block"
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <div className="grid grid-cols-[32px_1fr_24px] gap-4 mt-4">
                <span aria-hidden />
                <p className="font-mono text-[13px] leading-relaxed text-ink">{qa.a}</p>
                <span aria-hidden />
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
