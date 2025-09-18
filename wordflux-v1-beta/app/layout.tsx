import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'


import './styles/brand.css'
const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WordFlux v1.0 Beta',
  description: 'Real-time Kanban with AI Assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Force cache refresh for CSS - v110 ULTIMATE */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="skeleton-defense-version" content="v110-ultimate" />
        <meta name="cache-bust" content={`${Date.now()}`} />
      </head>
      <body className={inter.className}>
        {/* ULTRA NUCLEAR SKELETON KILLER v110 - Triple Method Defense */}
        {/* Modern minimal header - hidden on workspace */}
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
