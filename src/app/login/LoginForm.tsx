'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { buttonStyles } from '@/components/ui/Button'

const FOUNDER_EMAIL = 'matthew@updatewave.org'

interface LoginFormProps {
  /**
   * Optional sanitized `next` path (already validated server-side by
   * sanitizeNextParam). Forwarded to /auth/callback so the post-login
   * redirect lands on the tier-specific page the visitor was shopping for.
   * The `{hash}` placeholder, if present, is substituted by /auth/callback
   * after identity resolution.
   */
  next?: string | null
}

export default function LoginForm({ next }: LoginFormProps = {}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }

    setSubmitting(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const callbackUrl = next
        ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
        : `${origin}/auth/callback`
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: callbackUrl },
      })
      if (otpError) {
        setError(
          `We couldn't send your link right now. If you have your original UpdateWave link, use that, or email ${FOUNDER_EMAIL} for help.`
        )
        return
      }
      router.push(`/auth/check-email?email=${encodeURIComponent(trimmed)}`)
    } catch {
      setError(
        `We couldn't send your link right now. If you have your original UpdateWave link, use that, or email ${FOUNDER_EMAIL} for help.`
      )
    } finally {
      setSubmitting(false)
    }
  }

  const errorId = 'login-form-error'

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="login-form"
      noValidate
      aria-busy={submitting}
    >
      <div>
        <label
          htmlFor="login-email"
          className="block font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-2"
        >
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="block w-full border border-ink bg-paper px-3 py-2.5 font-mono text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:opacity-60"
          data-testid="login-email-input"
          placeholder="you@company.com"
        />
      </div>

      {error && (
        <div
          id={errorId}
          className="border border-accent px-3 py-2 font-mono text-[12px] leading-relaxed"
          data-testid="login-error"
          role="alert"
        >
          <span className="text-accent uppercase tracking-wider mr-1">Error ·</span>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full ${buttonStyles('primary')}`}
        data-testid="login-submit"
      >
        {submitting ? 'Sending…' : 'Send link →'}
      </button>
    </form>
  )
}
