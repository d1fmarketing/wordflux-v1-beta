import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
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
      <head>
        {/* Force cache refresh for CSS - v108 */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
      </head>
      <body className={inter.className}>
        {/* Nuclear JavaScript Skeleton Killer v108 */}
        <Script id="skeleton-killer" strategy="afterInteractive">
          {`
            // NUCLEAR SKELETON KILLER v108 - Runtime Protection
            if (typeof window !== 'undefined') {
              // Aggressive skeleton element remover
              const killSkeletons = () => {
                const selectors = [
                  '[class*="skeleton"]',
                  '[class*="Skeleton"]',
                  '[class*="shimmer"]',
                  '[class*="Shimmer"]',
                  '[class*="loading-overlay"]',
                  '[class*="LoadingOverlay"]',
                  '[data-skeleton]',
                  '[data-loading="true"]',
                  '[aria-busy="true"]'
                ];

                selectors.forEach(selector => {
                  document.querySelectorAll(selector).forEach(el => {
                    // Only hide, don't remove - removing breaks React
                    el.style.display = 'none';
                    el.style.visibility = 'hidden';
                    el.style.opacity = '0';
                    el.style.position = 'absolute';
                    el.style.left = '-9999px';
                  });
                });
              };

              // Run immediately
              killSkeletons();

              // Run on DOM ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', killSkeletons);
              }

              // Run periodically to catch any dynamically added elements
              setInterval(killSkeletons, 100);

              // Run on any DOM mutations
              const observer = new MutationObserver(killSkeletons);
              observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
              });
            }
          `}
        </Script>
        {/* Modern minimal header - hidden on workspace */}
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
