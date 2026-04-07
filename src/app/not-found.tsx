import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold text-[#111827] mb-4">404</h1>
        <p className="text-lg text-[#6b7280] mb-6">
          This page doesn&apos;t exist. Check your email for the correct link.
        </p>
        <Link
          href="/"
          className="inline-block bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-md text-sm font-medium transition-colors"
        >
          Go to homepage
        </Link>
      </div>
    </div>
  )
}
