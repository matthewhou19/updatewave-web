'use client'

import { useState } from 'react'
import { Project } from '@/lib/types'
import { formatRelativeTime } from '@/lib/utils'

interface ProjectCardProps {
  project: Project
  isRevealed: boolean
  hash?: string           // undefined = public visitor (no reveal capability)
  justRevealed?: boolean  // true if this card was just purchased (post-payment redirect)
}

// formatRelativeTime extracted to @/lib/utils for testability and reuse.
// Re-export for backwards compatibility.
export { formatRelativeTime } from '@/lib/utils'

export default function ProjectCard({ project, isRevealed, hash, justRevealed }: ProjectCardProps) {
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

  return (
    <div className={`bg-white rounded-lg shadow-sm p-4 border ${justRevealed ? 'border-[#16a34a] ring-2 ring-[#16a34a]/20' : 'border-gray-100'}`}>
      {justRevealed && (
        <div className="mb-3 px-3 py-1.5 bg-[#16a34a]/10 rounded text-sm text-[#16a34a] font-medium">
          ✓ Architect info revealed!
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-bold text-[16px] text-[#111827] leading-snug">
          {project.address}
        </span>
        <span className="text-xs text-[#71717a] whitespace-nowrap mt-0.5 flex-shrink-0">
          {formatRelativeTime(project.filing_date)}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {project.project_type && (
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-[#6b7280] rounded-full">
            {project.project_type}
          </span>
        )}
        {project.city && (
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-[#6b7280] rounded-full">
            {project.city}
          </span>
        )}
        {project.estimated_value && (
          <span className="text-sm text-[#6b7280]">{project.estimated_value}</span>
        )}
      </div>

      {isRevealed ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {project.architect_name && (
              <span className="font-bold text-sm text-[#111827]">{project.architect_name}</span>
            )}
            <span className="inline-block px-2 py-0.5 text-xs font-medium bg-[#16a34a]/10 text-[#16a34a] rounded-full">
              ✓ Revealed
            </span>
          </div>
          {project.architect_firm && (
            <p className="text-sm text-[#6b7280]">{project.architect_firm}</p>
          )}
          {project.architect_contact && (
            <p className="text-sm text-[#6b7280]">{project.architect_contact}</p>
          )}
          {project.architect_website && (
            <a
              href={project.architect_website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#2563eb] hover:text-[#1d4ed8]"
            >
              {project.architect_website}
            </a>
          )}
          {project.architect_website && (
            <p className="text-xs text-[#71717a] mt-1">Visit their website to see their portfolio →</p>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3">
            <div
              className="h-10 flex-1 bg-gray-200 rounded blur-sm"
              aria-label="Architect details hidden"
              role="img"
            />
            {hash ? (
              <button
                onClick={handleReveal}
                disabled={loading}
                className="flex-shrink-0 px-4 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#93c5fd] text-white text-sm font-medium rounded-md transition-colors cursor-pointer disabled:cursor-wait min-w-[120px] text-center"
              >
                {loading ? 'Processing...' : 'Reveal · $25'}
              </button>
            ) : (
              <span className="flex-shrink-0 px-4 py-2 bg-gray-300 text-[#6b7280] text-sm font-medium rounded-md min-w-[120px] text-center">
                $25 to reveal
              </span>
            )}
          </div>
          {loading && hash && (
            <p className="text-xs text-[#71717a] mt-2">
              You&apos;ll be redirected to Stripe to complete payment. You&apos;ll return here automatically.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-[#71717a] mt-3">
        {project.reveal_count} GC{project.reveal_count !== 1 ? 's' : ''} revealed
      </p>
    </div>
  )
}
