'use client'

import { useState } from 'react'
import { buttonStyles } from '@/components/ui/Button'

interface BuyButtonProps {
  hash: string
  city: string
}

export default function BuyButton({ hash, city }: BuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/create-list-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hash, city }),
      })

      const data = (await res.json()) as
        | { status: 'checkout'; url: string }
        | { status: 'already_purchased'; redirectTo: string }
        | { error: string }

      if (!res.ok) {
        const errMsg = 'error' in data ? data.error : 'Could not start checkout. Try again.'
        setError(errMsg)
        return
      }

      if ('status' in data && data.status === 'already_purchased') {
        window.location.href = data.redirectTo
        return
      }

      if ('status' in data && data.status === 'checkout') {
        window.location.href = data.url
        return
      }

      setError('Unexpected response from checkout.')
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
        data-testid="buy-button"
        className={`w-full sm:w-auto ${buttonStyles('primary')}`}
      >
        {loading ? 'Redirecting…' : 'Buy report →'}
      </button>
      {error && (
        <p className="font-mono text-[12px] text-accent mt-3" data-testid="buy-error">
          <span className="uppercase tracking-wider mr-1">Error ·</span>
          {error}
        </p>
      )}
    </div>
  )
}
