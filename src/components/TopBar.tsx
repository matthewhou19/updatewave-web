import Link from 'next/link'

interface TopBarProps {
  hash: string
  view: 'browse' | 'reveals'
}

export default function TopBar({ hash, view }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-[18px] text-[#111827]">UpdateWave</span>
        {view === 'browse' ? (
          <Link
            href={`/reveals/${hash}`}
            className="text-sm text-[#2563eb] hover:text-[#1d4ed8] font-medium"
            data-testid="topbar-link-reveals"
          >
            My Reveals →
          </Link>
        ) : (
          <Link
            href={`/browse/${hash}`}
            className="text-sm text-[#2563eb] hover:text-[#1d4ed8] font-medium"
            data-testid="topbar-link-browse"
          >
            ← Browse more projects
          </Link>
        )}
      </div>
    </header>
  )
}
