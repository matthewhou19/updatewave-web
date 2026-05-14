'use client'

import { useState } from 'react'
import { buttonStyles } from '@/components/ui/Button'

interface DownloadButtonProps {
  hash: string
  city: string
}

/**
 * Research-product DownloadButton. Mirrors the list product's DownloadButton,
 * but hits /api/download-research/[hash]/[city] which gates on
 * delivery_status='delivered'.
 */
export default function DownloadButton({ hash, city }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/download-research/${hash}/${city}`)
      const data = (await res.json()) as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not generate download link.')
        return
      }

      window.location.href = data.url
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        data-testid="download-button"
        className={`w-full sm:w-auto ${buttonStyles('primary')}`}
      >
        {loading ? 'Generating link…' : 'Download research PDF ↓'}
      </button>
      {error && (
        <p className="font-mono text-[12px] text-accent mt-3" data-testid="download-error">
          <span className="uppercase tracking-wider mr-1">Error ·</span>
          {error}
        </p>
      )}
    </div>
  )
}
