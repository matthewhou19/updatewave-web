interface Row {
  label: string
  us: string
  aggregator: string
  diy: string
}

const ROWS: Row[] = [
  {
    label: 'What you get',
    us: 'Structural analysis (PDF)',
    aggregator: 'Raw lead list',
    diy: 'Spreadsheet of permits',
  },
  {
    label: 'Time to insight',
    us: '5 minutes (read the report)',
    aggregator: 'Hours per lead',
    diy: '40+ hours',
  },
  {
    label: 'Tells you who actually decides',
    us: 'Yes — by tier and LLC',
    aggregator: 'No',
    diy: 'You have to figure it out',
  },
  {
    label: 'Cost',
    us: '$349 one-time',
    aggregator: '$99–$300 / month',
    diy: '"Free" + 40 hours of your time',
  },
  {
    label: 'Refundable',
    us: '7 days, no questions',
    aggregator: 'Annual contract',
    diy: 'N/A',
  },
]

export default function ComparisonTable() {
  return (
    <section className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[900px]">
            A lead list tells you names.
            <br />
            We tell you which names matter.
          </h2>
        </div>

        <div className="border border-ink mt-12">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-ink">
            <div className="hidden md:block p-5 bg-paper border-r border-ink" />
            <div className="p-5 bg-accent text-paper font-serif text-[16px] font-semibold border-r border-ink">
              UpdateWave analysis
            </div>
            <div className="p-5 bg-ink text-paper font-serif text-[16px] font-semibold border-r border-ink">
              Lead aggregators
            </div>
            <div className="p-5 bg-ink text-paper font-serif text-[16px] font-semibold">
              Doing it yourself
            </div>
          </div>

          {ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr] ${i === ROWS.length - 1 ? '' : 'border-b border-ink'}`}
            >
              <div className="p-5 bg-grey-100 border-r border-ink font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                {row.label}
              </div>
              <div className="p-5 border-r border-ink font-mono text-[13px] font-semibold">{row.us}</div>
              <div className="p-5 border-r border-ink font-mono text-[13px]">{row.aggregator}</div>
              <div className="p-5 font-mono text-[13px]">{row.diy}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
