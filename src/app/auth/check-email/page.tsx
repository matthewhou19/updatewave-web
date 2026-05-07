import TopBar from '@/components/TopBar'

interface CheckEmailPageProps {
  searchParams: Promise<{ email?: string }>
}

export const dynamic = 'force-dynamic'

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const { email } = await searchParams
  const display = typeof email === 'string' && email.length > 0 ? email : null

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <div className="border border-ink bg-paper p-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-3">
            Almost there
          </p>
          <h1 className="font-serif text-[28px] font-semibold tracking-tight mb-4">
            Check your email
          </h1>
          <p className="font-mono text-[13px] text-ink leading-relaxed mb-3">
            {display ? (
              <>
                We sent a one-time link to{' '}
                <span className="font-semibold">{display}</span>.
              </>
            ) : (
              'We sent a one-time link to the address you entered.'
            )}
          </p>
          <p className="font-mono text-[12px] text-muted leading-relaxed">
            Click the link in the email to finish logging in. Check your spam folder if you
            don&apos;t see it within a minute.
          </p>
        </div>
      </main>
    </div>
  )
}
