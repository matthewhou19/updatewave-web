import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth'
import { sanitizeNext, applyHashToNext } from '@/lib/safe-next'
import TopBar from '@/components/TopBar'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

const ERROR_COPY: Record<string, string> = {
  invalid_link: 'That link is missing required information. Please request a new one.',
  link_expired: 'That link has expired or already been used. Please request a new one.',
  session_failed: 'We couldn’t finish signing you in. Please try again.',
  account_unavailable:
    'This account is no longer active. Email matthew@updatewave.org if you think this is a mistake.',
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser(supabase)
  const params = await searchParams
  const next = sanitizeNext(params.next)

  if (user) {
    const dest = next ? applyHashToNext(next, user.hash) : `/browse/${user.hash}`
    redirect(dest)
  }

  const { error } = params
  const errorMessage = error && ERROR_COPY[error] ? ERROR_COPY[error] : null

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <div className="border border-ink bg-paper p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            Sign in
          </p>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight mb-4">
            Log in or sign up
          </h1>
          <p className="font-mono text-[13px] text-ink leading-relaxed mb-6">
            Enter your email. We&apos;ll send you a one-time link. New here? We&apos;ll create your
            account on the first click — no password required.
          </p>

          {errorMessage && (
            <div
              className="mb-5 border border-accent px-3 py-2 text-[12px] font-mono leading-relaxed"
              data-testid="login-callback-error"
              role="alert"
            >
              <span className="text-accent uppercase tracking-wider mr-1">Error ·</span>
              {errorMessage}
            </div>
          )}

          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-muted">
          Already have your UpdateWave link from email? Just click that link again.
        </p>
      </main>
    </div>
  )
}
