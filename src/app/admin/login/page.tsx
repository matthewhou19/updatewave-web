import { redirect } from 'next/navigation'
import { sanitizeNext } from '@/lib/safe-next'
import { isAdminAuthed } from '@/lib/admin-auth'
import { buttonStyles } from '@/components/ui/Button'
import { loginAdmin } from './actions'

export const dynamic = 'force-dynamic'

interface AdminLoginPageProps {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const params = await searchParams
  const next = sanitizeNext(params.next) ?? '/admin/leads'

  if (await isAdminAuthed()) {
    redirect(next)
  }

  const showError = params.error === '1'

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <div className="border border-ink bg-paper p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">Admin</p>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight mb-4">
            Lead review sign-in
          </h1>
          <p className="font-mono text-[13px] text-ink leading-relaxed mb-6">
            Enter the admin password.
          </p>

          {showError && (
            <div
              className="mb-5 border border-accent px-3 py-2 text-[12px] font-mono leading-relaxed"
              data-testid="admin-login-error"
              role="alert"
            >
              <span className="text-accent uppercase tracking-wider mr-1">Error ·</span>
              Wrong password.
            </div>
          )}

          <form action={loginAdmin} className="space-y-4" data-testid="admin-login-form">
            <input type="hidden" name="next" value={next} />
            <div>
              <label
                htmlFor="admin-password"
                className="block font-mono text-[11px] uppercase tracking-[0.1em] text-muted mb-2"
              >
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                className="block w-full border border-ink bg-paper px-3 py-2.5 font-mono text-[13px] text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                data-testid="admin-password-input"
              />
            </div>
            <button
              type="submit"
              className={`w-full ${buttonStyles('primary')}`}
              data-testid="admin-login-submit"
            >
              Enter →
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
