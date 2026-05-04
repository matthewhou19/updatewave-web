'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const FOUNDER_EMAIL = 'matthew@updatewave.com'

export default function LoginForm() {
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
      const origin =
        typeof window !== 'undefined' ? window.location.origin : ''
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: `${origin}/auth/callback` },
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

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-testid="login-form"
      noValidate
    >
      <label className="block">
        <span className="text-sm text-[#6b7280]">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-[#111827] focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] disabled:opacity-60"
          data-testid="login-email-input"
          placeholder="you@company.com"
        />
      </label>

      {error && (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          data-testid="login-error"
          role="alert"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-[#2563eb] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:opacity-60"
        data-testid="login-submit"
      >
        {submitting ? 'Sending…' : 'Send link'}
      </button>
    </form>
  )
}
