'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Project } from '@/lib/types'
import { Drawing } from '@/lib/drawings'
import { formatRelativeTime, formatProjectType, maskStreetNumber } from '@/lib/utils'
import { buttonStyles } from './ui/Button'

const ANONYMOUS_REVEAL_LOGIN_HREF = `/login?next=${encodeURIComponent('/browse/{hash}')}`

interface ProjectCardProps {
  project: Project
  isRevealed: boolean
  hash?: string
  justRevealed?: boolean
  /**
   * 'demo' renders a read-only card for marketing surfaces (e.g. the homepage
   * "we monitor the market live" proof section): no $199 price, no reveal CTA,
   * no sign-in link. Defaults to 'transactional' which is the /browse behaviour.
   */
  mode?: 'transactional' | 'demo'
  /**
   * Flexible pre-reveal manifest — which of these this lead actually has.
   * Undefined on demo cards, where the manifest isn't shown.
   */
  hasOwnerContact?: boolean
  hasArchitectContact?: boolean
  hasDrawings?: boolean
  /** Signed drawing download links — populated only once revealed. */
  drawings?: Drawing[]
}

// Re-export for backwards compatibility with tests that import from this module.
export { formatRelativeTime } from '@/lib/utils'

function MaskedAddress({ address }: { address: string }) {
  const masked = maskStreetNumber(address)
  // maskStreetNumber returns "••• Oak St". Split on the first space-then-letter boundary
  // so we can wrap the bullet prefix in a blur span.
  const idx = masked.search(/\s[A-Za-z]/)
  if (idx <= 0) return <>{masked}</>
  return (
    <>
      <span className="bg-grey-200 text-transparent px-1.5 select-none">{masked.slice(0, idx)}</span>
      {masked.slice(idx)}
    </>
  )
}

function ManifestItem({ label }: { label: string }) {
  return (
    <li className="flex items-baseline gap-2 font-mono text-[12px] text-ink">
      <span className="text-accent" aria-hidden>+</span>
      <span>{label}</span>
    </li>
  )
}

export default function ProjectCard({
  project,
  isRevealed,
  hash,
  justRevealed,
  mode = 'transactional',
  hasOwnerContact = false,
  hasArchitectContact = false,
  hasDrawings = false,
  drawings = [],
}: ProjectCardProps) {
  const [loading, setLoading] = useState(false)

  async function handleReveal() {
    if (!hash) return
    setLoading(true)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, projectId: project.id }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }

      const data = await res.json()

      if (data.message === 'Already revealed.') {
        window.location.reload()
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const borderClass = justRevealed ? 'border-accent ring-2 ring-accent/20' : 'border-ink'

  return (
    <article
      className={`border ${borderClass} bg-paper p-5 grid grid-cols-[1fr_auto] gap-4`}
      data-testid={justRevealed ? 'just-revealed-card' : 'project-card'}
    >
      <div className="min-w-0">
        {justRevealed && (
          <div
            className="mb-3 px-2 py-1 border border-accent text-accent font-mono text-[11px] uppercase tracking-wider inline-block"
            data-testid="just-revealed-banner"
          >
            ✓ Lead unlocked
          </div>
        )}

        <div className="flex items-center gap-2 mb-1.5 font-mono text-[10px] text-muted uppercase tracking-wider">
          <span className="text-accent" aria-hidden>●●●</span>
          <span>{formatRelativeTime(project.filing_date)}</span>
          {project.city && (
            <>
              <span aria-hidden>·</span>
              <span>{project.city.toUpperCase()}</span>
            </>
          )}
        </div>

        <div className="font-serif text-[22px] font-semibold leading-tight tracking-tight mb-2 break-words">
          {isRevealed ? project.address : <MaskedAddress address={project.address} />}
        </div>

        {project.description && (
          <p className="font-mono text-[12px] text-ink leading-relaxed mb-3">{project.description}</p>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {project.project_type && (
            <span className="font-mono text-[10px] px-2 py-0.5 border border-grey-300 text-muted uppercase tracking-wider">
              {formatProjectType(project.project_type)}
            </span>
          )}
          {project.estimated_value && (
            <span className="font-mono text-[10px] px-2 py-0.5 border border-grey-300 text-muted">
              {project.estimated_value}
            </span>
          )}
        </div>

        {mode === 'transactional' && !isRevealed && (
          <div className="mt-4 pt-4 border-t border-grey-300" data-testid="reveal-manifest">
            <div className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">
              Unlock on reveal
            </div>
            <ul className="space-y-1">
              <ManifestItem label="Exact street address" />
              {hasOwnerContact && <ManifestItem label="Property owner — name & phone/email" />}
              {hasArchitectContact && <ManifestItem label="Architect / designer — firm & contact" />}
              {hasDrawings && <ManifestItem label="Architectural drawings" />}
            </ul>
          </div>
        )}

        {isRevealed && (project.architect_firm || project.architect_contact || project.architect_website) && (
          <div className="mt-4 pt-4 border-t border-grey-300">
            {project.architect_firm && (
              <div className="font-serif text-[16px] font-semibold mb-1">{project.architect_firm}</div>
            )}
            {project.architect_contact && (
              <p className="font-mono text-[12px] text-muted mb-1">{project.architect_contact}</p>
            )}
            {project.architect_website && (
              <>
                <a
                  href={project.architect_website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[12px] text-accent border-b border-accent break-all"
                >
                  {project.architect_website}
                </a>
                <p className="font-mono text-[10px] text-muted mt-1">Visit their portfolio →</p>
              </>
            )}
          </div>
        )}

        {isRevealed && drawings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-grey-300">
            <div className="font-mono text-[10px] text-muted uppercase tracking-wider mb-2">
              Architectural drawings
            </div>
            <div className="flex flex-wrap gap-2" data-testid="drawings">
              {drawings.map((d) => (
                <a
                  key={d.name}
                  href={d.url}
                  download={d.name}
                  title={d.name}
                  className={buttonStyles('outline', 'sm')}
                  data-testid="drawing-download"
                >
                  ↓ {d.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {loading && hash && (
          <p className="font-mono text-[10px] text-muted mt-3">
            You&apos;ll be redirected to Stripe to complete payment. You&apos;ll return here automatically.
          </p>
        )}
      </div>

      <div className="flex flex-col items-end justify-between text-right gap-3">
        {mode === 'demo' ? (
          <div className="font-mono text-[10px] text-muted uppercase tracking-[0.1em] leading-relaxed max-w-[120px]">
            <span className="text-accent" aria-hidden>●</span> Public record
            <br />
            monitored daily
          </div>
        ) : (
          <>
            <div>
              {!isRevealed && (
                <>
                  <div className="font-serif text-[24px] font-semibold leading-none">$199</div>
                  <div className="font-mono text-[10px] text-muted mt-1">
                    {project.reveal_count} GC{project.reveal_count !== 1 ? 's' : ''} revealed
                  </div>
                </>
              )}
              {isRevealed && (
                <span className="font-mono text-[10px] text-accent uppercase tracking-wider border border-accent px-2 py-1 inline-block">
                  ✓ Revealed
                </span>
              )}
            </div>
            {!isRevealed &&
              (hash ? (
                <button
                  onClick={handleReveal}
                  disabled={loading}
                  className={buttonStyles('primary', 'sm')}
                >
                  {loading ? 'Processing...' : 'Reveal · $199'}
                </button>
              ) : (
                <Link
                  href={ANONYMOUS_REVEAL_LOGIN_HREF}
                  data-testid="anonymous-reveal-cta"
                  className={buttonStyles('primary', 'sm')}
                >
                  Sign in to reveal · $199
                </Link>
              ))}
          </>
        )}
      </div>
    </article>
  )
}
