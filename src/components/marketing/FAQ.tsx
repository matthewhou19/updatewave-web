interface QA {
  q: string
  a: string
}

const QAS: QA[] = [
  {
    q: 'Where does the data come from?',
    a: 'San Jose Planning Commission filings — public records that get posted before permits are issued. We monitor new filings continuously and republish them in a structured format with architect attribution.',
  },
  {
    q: 'How often is the data updated?',
    a: 'Continuously. New filings show up within hours of being posted by the city. We typically surface 4–8 new residential projects per day.',
  },
  {
    q: 'What exactly do I get when I unlock a lead?',
    a: 'The full street address, the architect firm name, and the architect\'s direct contact (email or phone, depending on what\'s on file). Plus a link to their website if we have it. Most filings also include the owner name and project value.',
  },
  {
    q: 'What if the contact info is wrong or outdated?',
    a: 'Full refund, no questions. Email matthew@updatewave.com with the lead ID and we\'ll process it within 24 hours. We refund both wrong contacts and contacts who refuse to engage on principle (architects who never wanted to be listed).',
  },
  {
    q: 'Can architects opt out of being listed?',
    a: 'Yes. Architects can email matthew@updatewave.com to be removed within 48 hours. We honor opt-outs unconditionally and refund any reveals of removed contacts.',
  },
  {
    q: 'Is this legal? Is this public information?',
    a: 'Yes. All filings come from public planning commission records — the same records anyone can request from the city. We just structure and republish them. We don\'t scrape any private data.',
  },
  {
    q: 'How is this different from BuildZoom or Dodge?',
    a: 'Stage and price. BuildZoom/Dodge sell post-permit data on annual subscriptions ($99–$300/mo). We sell pre-permit filings on a $25 per-lead basis. By the time those tools surface a project, the homeowner has usually already chosen a GC. We catch the project 30–60 days earlier.',
  },
  {
    q: 'Do you offer refunds on a reveal?',
    a: 'Yes — within 7 days of purchase if the contact info is wrong, outdated, or the architect has opted out. Email matthew@updatewave.com with the lead ID.',
  },
]

export default function FAQ() {
  return (
    <section className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            Questions GCs ask before their first reveal.
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
