import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { getCurrentUser } from '@/lib/auth'
import LoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

const ERROR_COPY: Record<string, string> = {
  invalid_link: 'That link is missing required information. Please request a new one.',
  link_expired: 'That link has expired or already been used. Please request a new one.',
  session_failed: 'We couldn’t finish signing you in. Please try again.',
  account_unavailable:
    'This account is no longer active. Email matthew@updatewave.com if you think this is a mistake.',
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser(supabase)

  if (user) {
    redirect(`/browse/${user.hash}`)
  }

  const { error } = await searchParams
  const errorMessage = error && ERROR_COPY[error] ? ERROR_COPY[error] : null

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5]">
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-[#111827]">Log in</h1>
          <p className="mb-6 text-sm text-[#6b7280]">
            Enter your email. We&apos;ll send you a one-time link to access
            your account.
          </p>

          {errorMessage && (
            <p
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              data-testid="login-callback-error"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-[#9ca3af]">
          Already have your UpdateWave link from email? Just click that link
          again.
        </p>
      </main>
    </div>
  )
}
