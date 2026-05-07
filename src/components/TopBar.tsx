import Link from 'next/link'
import { buttonStyles } from './ui/Button'

interface TopBarProps {
  hash?: string
  view?: 'browse' | 'reveals' | 'public'
}

export default function TopBar({ hash, view = 'public' }: TopBarProps) {
  const isAuth = view === 'browse' || view === 'reveals'

  return (
    <nav className="border-b border-ink bg-paper">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-5 flex items-center justify-between gap-6">
        <Link
          href={hash ? `/browse/${hash}` : '/'}
          className="font-serif font-extrabold text-[20px] tracking-tight text-ink no-underline"
        >
          UpdateWave<span className="text-accent">.</span>
        </Link>

        {!isAuth && (
          <ul className="hidden md:flex items-center gap-7 list-none font-mono text-[12px]">
            <li>
              <Link href="/#how" className="text-ink no-underline border-b border-transparent hover:border-ink pb-0.5">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/#coverage" className="text-ink no-underline border-b border-transparent hover:border-ink pb-0.5">
                Coverage
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="text-ink no-underline border-b border-transparent hover:border-ink pb-0.5">
                Pricing
              </Link>
            </li>
          </ul>
        )}

        <div className="flex items-center gap-3">
          {isAuth && hash ? (
            view === 'browse' ? (
              <Link
                href={`/reveals/${hash}`}
                className="font-mono text-[12px] text-ink no-underline border-b border-transparent hover:border-ink pb-0.5"
                data-testid="topbar-link-reveals"
              >
                My purchases →
              </Link>
            ) : (
              <Link
                href={`/browse/${hash}`}
                className="font-mono text-[12px] text-ink no-underline border-b border-transparent hover:border-ink pb-0.5"
                data-testid="topbar-link-browse"
              >
                ← Browse more projects
              </Link>
            )
          ) : (
            <>
              <Link href="/login" className={buttonStyles('outline')} data-testid="home-login-link">
                Log in
              </Link>
              <Link href="/login" className={buttonStyles('primary')}>
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
