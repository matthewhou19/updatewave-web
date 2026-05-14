import Link from 'next/link'
import TopBar from '@/components/TopBar'
import Footer from '@/components/marketing/Footer'
import { buttonStyles } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <TopBar view="public" />
      <main className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="text-center max-w-lg">
          <h1 className="font-serif text-[96px] md:text-[128px] font-semibold leading-none tracking-tight">
            404
          </h1>
          <p className="font-mono text-[14px] text-ink mt-4 mb-8">
            This page doesn&apos;t exist. Check your email for the correct link.
          </p>
          <Link href="/" className={buttonStyles('primary')}>
            ← Back to listings
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
