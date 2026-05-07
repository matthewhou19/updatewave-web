import { buttonStyles } from '../ui/Button'

interface City {
  name: string
  status: string
  live?: boolean
}

const CITIES: City[] = [
  { name: 'San Jose, CA', status: '● Live now', live: true },
  { name: 'Oakland, CA', status: 'Q1 2027' },
  { name: 'San Francisco, CA', status: 'Q1 2027' },
  { name: 'Mountain View, CA', status: 'Q2 2027' },
  { name: 'Palo Alto, CA', status: 'Q2 2027' },
  { name: 'Berkeley, CA', status: 'On waitlist' },
  { name: 'Your city?', status: 'Notify me ↓' },
]

export default function Coverage() {
  return (
    <section id="coverage" className="border-b border-dashed border-ink px-6 md:px-12 py-16 md:py-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8">
          <h2 className="font-serif text-[32px] md:text-[44px] leading-tight font-semibold tracking-tight max-w-[800px]">
            One city now. The Bay Area next.
          </h2>
          <p className="font-mono text-[13px] text-muted mt-3 max-w-[600px]">
            Get notified when UpdateWave goes live in your service area. Early-access GCs get the
            first 5 reveals on us.
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
              San Jose · LIVE
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
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <input
                type="email"
                placeholder="your@company.com"
                disabled
                className="flex-1 px-3 py-2.5 border border-ink bg-paper font-mono text-[12px] focus:outline-none disabled:opacity-60"
                aria-label="Email for coverage notifications"
              />
              <button type="button" disabled className={`${buttonStyles('primary')} opacity-50 cursor-not-allowed`}>
                Notify me · soon
              </button>
            </div>
            <p className="font-mono text-[10px] text-muted mt-2">
              Email capture going live shortly. For now, ping{' '}
              <a href="mailto:matthew@updatewave.com" className="underline">
                matthew@updatewave.com
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
