import Link from 'next/link'

interface Col {
  heading: string
  links: { label: string; href: string }[]
}

const COLS: Col[] = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/#how' },
      { label: 'Coverage', href: '/#coverage' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Log in', href: '/login' },
    ],
  },
  {
    heading: 'For Architects',
    links: [
      { label: 'Opt out', href: 'mailto:matthew@updatewave.com?subject=Opt%20out%20of%20UpdateWave' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Contact', href: 'mailto:matthew@updatewave.com' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="bg-paper px-6 md:px-12 pt-16 pb-8">
      <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="font-serif font-extrabold text-[28px] tracking-tight no-underline text-ink">
            UpdateWave<span className="text-accent">.</span>
          </Link>
          <p className="font-mono text-[12px] text-muted mt-3 max-w-[280px] leading-relaxed">
            Pre-permit residential intelligence for general contractors. Sourced from public planning
            commission filings.
          </p>
        </div>
        {COLS.map((col) => (
          <div key={col.heading}>
            <h4 className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-4">
              {col.heading}
            </h4>
            <ul className="list-none">
              {col.links.map((link) => (
                <li key={link.label} className="font-mono text-[12px] py-1">
                  {link.href.startsWith('mailto:') || link.href.startsWith('http') ? (
                    <a href={link.href} className="text-ink no-underline hover:underline">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-ink no-underline hover:underline">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-[1200px] mx-auto mt-12 pt-6 border-t border-grey-300 flex flex-col md:flex-row justify-between gap-3 font-mono text-[11px] text-muted">
        <span>© {new Date().getFullYear()} UpdateWave</span>
        <span>All listings sourced from public records. Architects may request listing removal.</span>
      </div>
    </footer>
  )
}
