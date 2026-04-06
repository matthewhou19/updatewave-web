import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UpdateWave — Pre-Permit Leads',
  description: 'Browse pre-permit project listings and connect with architects early.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body
        className="min-h-full"
        style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        {children}
      </body>
    </html>
  )
}
