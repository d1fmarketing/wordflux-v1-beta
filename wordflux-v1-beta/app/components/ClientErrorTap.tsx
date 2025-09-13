'use client';
import { useEffect } from 'react';

export default function ClientErrorTap() {
  useEffect(() => {
    const logError = async (message: string, stack?: string, source?: string) => {
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'client-error',
            message,
            stack,
            source,
            url: window.location.href,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        // Silently fail to avoid infinite error loops
        console.error('Failed to log error:', err);
      }
    };

    const handleError = (event: ErrorEvent) => {
      logError(
        event.message,
        event.error?.stack,
        `${event.filename}:${event.lineno}:${event.colno}`
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logError(
        `Unhandled Promise Rejection: ${event.reason}`,
        event.reason?.stack,
        'promise-rejection'
      );
    };

    // Attach error handlers
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Clean up on unmount
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null; // This component doesn't render anything
}