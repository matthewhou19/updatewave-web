import type { Metadata } from 'next'
import { Fraunces, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
})

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
    <html lang="en" className={`h-full ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="referrer" content="no-referrer" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
