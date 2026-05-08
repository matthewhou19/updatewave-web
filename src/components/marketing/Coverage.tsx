interface City {
  name: string
  status: string
  live?: boolean
}

const CITIES: City[] = [
  { name: 'San Jose, CA', status: '● $349 instant', live: true },
  { name: 'Oakland, CA', status: '$1,999 on request' },
  { name: 'San Francisco, CA', status: '$1,999 on request' },
  { name: 'Mountain View, CA', status: '$1,999 on request' },
  { name: 'Palo Alto, CA', status: '$1,999 on request' },
  { name: 'Berkeley, CA', status: '$1,999 on request' },
  { name: 'Your city?', status: 'Email Matthew ↓' },
]

export default function Coverage() {
  return (
    <section id="coverage" className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            San Jose today. Any Bay Area city you ask about.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3 max-w-[640px]">
            The $349 SJ report ships instantly. For any other Bay Area city, the $1,999 custom
            research delivers the same analysis in 5–10 days, plus 90 days of weekly permit
            monitoring on top.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-12 md:gap-16 mt-12 items-start">
          <div
            className="aspect-[4/3] border border-grey-300 relative"
            style={{
              background:
                'radial-gradient(circle at 30% 60%, var(--color-accent) 0 8px, transparent 9px), repeating-linear-gradient(0deg, var(--color-grey-200) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, var(--color-grey-200) 0 1px, transparent 1px 32px), var(--color-grey-100)',
            }}
            aria-label="Coverage map placeholder showing San Jose pin"
          >
            <div className="absolute left-[32%] top-[62%] -translate-y-[120%] font-mono text-[11px] bg-ink text-paper px-2 py-1 whitespace-nowrap">
              San Jose · ANALYZED
            </div>
          </div>

          <div>
            <ul className="list-none">
              {CITIES.map((city) => (
                <li
                  key={city.name}
                  className="flex justify-between items-center py-3.5 border-b border-grey-300 font-mono text-[13px]"
                >
                  <span>{city.name}</span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.1em] ${city.live ? 'text-accent font-bold' : 'text-muted'}`}
                  >
                    {city.status}
                  </span>
                </li>
              ))}
            </ul>
            <p className="font-mono text-[12px] text-muted mt-6 leading-relaxed">
              Need a city not listed?{' '}
              <a href="mailto:matthew@updatewave.com?subject=Custom%20research%20for%20my%20city" className="underline text-ink">
                matthew@updatewave.com
              </a>
              . If we have data access for the city, we&apos;ll quote you.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
