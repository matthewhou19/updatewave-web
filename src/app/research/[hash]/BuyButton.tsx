'use client'

import { useState } from 'react'
import { buttonStyles } from '@/components/ui/Button'

interface BuyButtonProps {
  hash: string
  /** Selected city slug from the dropdown. For v1 this is always 'sj'. */
  city: string
  /** Disables the button (e.g. no city selected yet). */
  disabled?: boolean
}

/**
 * Research-product BuyButton. Mirrors the list product's BuyButton, but POSTs
 * to /api/create-research-checkout and uses research-specific copy.
 *
 * Per design doc: "Configure research →" copy, blue primary button, full-width
 * on mobile, 44px min touch target.
 */
export default function BuyButton({ hash, city, disabled = false }: BuyButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/create-research-checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hash, city }),
      })

      const data = (await res.json()) as
        | { status: 'checkout'; url: string }
        | { status: 'already_purchased'; redirectTo: string }
        | { error: string }

      if (!res.ok) {
        const errMsg =
          'error' in data ? data.error : 'Could not start checkout. Try again.'
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
        disabled={loading || disabled}
        data-testid="buy-button"
        className={`w-full sm:w-auto ${buttonStyles('primary')}`}
      >
        {loading ? 'Redirecting…' : 'Configure research →'}
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
