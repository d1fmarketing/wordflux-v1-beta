import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

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
      <body className={inter.className}>
        {/* Modern minimal header - hidden on workspace */}
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}