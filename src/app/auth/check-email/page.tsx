interface CheckEmailPageProps {
  searchParams: Promise<{ email?: string }>
}

export const dynamic = 'force-dynamic'

export default async function CheckEmailPage({
  searchParams,
}: CheckEmailPageProps) {
  const { email } = await searchParams
  const display = typeof email === 'string' && email.length > 0 ? email : null

  return (
    <div className="flex min-h-screen flex-col bg-[#f5f5f5]">
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm text-center">
          <h1 className="mb-2 text-xl font-bold text-[#111827]">
            Check your email
          </h1>
          <p className="mb-4 text-sm text-[#6b7280]">
            {display ? (
              <>
                We sent a one-time link to{' '}
                <span className="font-medium text-[#111827]">{display}</span>.
              </>
            ) : (
              'We sent a one-time link to the address you entered.'
            )}
          </p>
          <p className="text-sm text-[#6b7280]">
            Click the link in the email to finish logging in. Check your spam
            folder if you don&apos;t see it within a minute.
          </p>
        </div>
      </main>
    </div>
  )
}
