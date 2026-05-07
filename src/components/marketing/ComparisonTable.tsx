interface Row {
  label: string
  us: string
  permit: string
  word: string
}

const ROWS: Row[] = [
  {
    label: 'Stage of intel',
    us: 'Pre-permit (filing)',
    permit: 'Post-permit',
    word: 'Post-construction',
  },
  {
    label: 'Lead time advantage',
    us: '30–60 days early',
    permit: '0 days',
    word: 'Weeks late',
  },
  {
    label: 'Cost',
    us: '$25 / lead',
    permit: '$99–$300 / month',
    word: '"Free" + unreliable',
  },
  {
    label: 'Architect contact',
    us: 'Direct, verified',
    permit: 'Sometimes',
    word: 'Maybe',
  },
  {
    label: 'Commitment',
    us: 'Pay per lead',
    permit: 'Annual contract',
    word: 'Years of network-building',
  },
]

export default function ComparisonTable() {
  return (
    <section className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[900px]">
            Other tools tell you a project broke ground.
            <br />
            We tell you it was thought of.
          </h2>
        </div>

        <div className="border border-ink mt-12">
          <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-ink">
            <div className="hidden md:block p-5 bg-paper border-r border-ink" />
            <div className="p-5 bg-accent text-paper font-serif text-[16px] font-semibold border-r border-ink">
              UpdateWave
            </div>
            <div className="p-5 bg-ink text-paper font-serif text-[16px] font-semibold border-r border-ink">
              Permit-tracking tools
            </div>
            <div className="p-5 bg-ink text-paper font-serif text-[16px] font-semibold">Word of mouth</div>
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
              <div className="p-5 border-r border-ink font-mono text-[13px]">{row.permit}</div>
              <div className="p-5 font-mono text-[13px]">{row.word}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
