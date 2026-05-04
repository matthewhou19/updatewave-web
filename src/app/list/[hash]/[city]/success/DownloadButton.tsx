'use client'

import { useState } from 'react'

interface DownloadButtonProps {
  hash: string
  city: string
}

export default function DownloadButton({ hash, city }: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/download-list/${hash}/${city}`)
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
        className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#94a3b8] text-white text-base font-semibold rounded-md transition-colors min-h-[44px]"
      >
        {loading ? 'Generating link…' : 'Download report'}
      </button>
      {error && (
        <p className="text-sm text-[#dc2626] mt-3" data-testid="download-error">
          {error}
        </p>
      )}
    </div>
  )
}
