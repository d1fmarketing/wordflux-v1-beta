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
        {/* Force cache refresh for CSS - v110 ULTIMATE */}
        <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate, max-age=0" />
        <meta httpEquiv="Pragma" content="no-cache" />
        <meta httpEquiv="Expires" content="0" />
        <meta name="skeleton-defense-version" content="v110-ultimate" />
        <meta name="cache-bust" content={`${Date.now()}`} />
      </head>
      <body className={inter.className}>
        {/* ULTRA NUCLEAR SKELETON KILLER v110 - Triple Method Defense */}
        <Script id="skeleton-killer" strategy="afterInteractive">
          {`
            // ULTIMATE SKELETON ELIMINATION v110
            if (typeof window !== 'undefined') {
              // Method 1: Inject global override styles
              const injectKillerStyles = () => {
                if (!document.getElementById('skeleton-killer-styles')) {
                  const style = document.createElement('style');
                  style.id = 'skeleton-killer-styles';
                  style.innerHTML = \`
                    /* RUNTIME SKELETON KILLER v110 */
                    *[class*="skeleton"],
                    *[class*="Skeleton"],
                    *[class*="shimmer"],
                    *[class*="Shimmer"],
                    *[class*="loading-overlay"],
                    *[class*="LoadingOverlay"],
                    *[data-skeleton],
                    *[data-loading="true"] {
                      display: none !important;
                      opacity: 0 !important;
                      visibility: hidden !important;
                      position: absolute !important;
                      left: -999999px !important;
                      pointer-events: none !important;
                      z-index: -999999 !important;
                    }
                  \`;
                  document.head.appendChild(style);
                }
              };

              // Method 2: Remove skeleton classes from elements
              const removeSkeletonClasses = () => {
                document.querySelectorAll('[class*="skeleton"], [class*="shimmer"]').forEach(el => {
                  const newClass = el.className.replace(/\\b[\\w-]*skeleton[\\w-]*\\b/gi, '')
                                               .replace(/\\b[\\w-]*shimmer[\\w-]*\\b/gi, '')
                                               .replace(/\\s+/g, ' ')
                                               .trim();
                  if (el.className !== newClass) {
                    el.className = newClass;
                  }
                });
              };

              // Method 3: Hide skeleton elements
              const hideSkeletonElements = () => {
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
                  try {
                    document.querySelectorAll(selector).forEach(el => {
                      el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; position: absolute !important; left: -999999px !important;';
                      el.setAttribute('data-skeleton-killed', 'true');
                    });
                  } catch (e) {
                    // Ignore selector errors
                  }
                });
              };

              // Execute all methods
              const executeTripleKill = () => {
                injectKillerStyles();
                removeSkeletonClasses();
                hideSkeletonElements();
              };

              // Run immediately
              executeTripleKill();

              // Run on DOM ready
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', executeTripleKill);
              } else {
                // DOM already loaded, run again
                executeTripleKill();
              }

              // Run periodically (every 50ms for first 2 seconds, then every 200ms)
              let fastInterval = setInterval(executeTripleKill, 50);
              setTimeout(() => {
                clearInterval(fastInterval);
                setInterval(executeTripleKill, 200);
              }, 2000);

              // Run on any DOM mutations
              const observer = new MutationObserver((mutations) => {
                executeTripleKill();
              });

              // Start observing when body is ready
              const startObserving = () => {
                if (document.body) {
                  observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'data-skeleton', 'data-loading']
                  });
                } else {
                  setTimeout(startObserving, 10);
                }
              };
              startObserving();

              // Log success
              console.log('[SKELETON-KILLER-v110] Triple defense activated');
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
