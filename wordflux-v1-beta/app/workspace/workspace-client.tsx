'use client'

import { useEffect, useState } from 'react'
import WorkingBoard from '../components/WorkingBoard'
import Chat from '../components/Chat'
import ErrorBoundary from '../components/ErrorBoundary'
import { ClientErrorBoundary } from '../components/ClientErrorBoundary'
import { HEADER_HEIGHT_REM, CHAT_FIXED_PX, LAYOUT_BG, BORDER, SURFACE } from '../ui/tokens'

export default function ClientWorkspace() {
  const [mounted, setMounted] = useState(false)
  const [deployCount, setDeployCount] = useState<number | null>(null)

  // Ensure we're mounted before rendering anything complex
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const load = () => {
      fetch('/api/deploy', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (d?.ok && typeof d.count === 'number') setDeployCount(d.count) })
        .catch(() => {})
    }
    load()
    const iv = window.setInterval(load, 30000)
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { window.clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [mounted])

  // Don't render until we're in the browser
  if (!mounted) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af' }}>
        Loading workspace...
      </div>
    )
  }

  return (
    <div style={{
      height: `calc(100dvh - ${HEADER_HEIGHT_REM}rem)`,
      display: 'flex',
      width: '100%',
      minHeight: 0,
      overflow: 'hidden',
      backgroundColor: LAYOUT_BG
    }}>
      {/* Chat (fixed width) on the left */}
      <div
        data-testid="chat-panel"
        style={{
          width: `${CHAT_FIXED_PX}px`,
          minWidth: CHAT_FIXED_PX,
          maxWidth: CHAT_FIXED_PX,
          flexShrink: 0,
          borderRight: `1px solid ${BORDER}`,
          background: SURFACE,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}
      >
        <ErrorBoundary fallback={<div style={{ padding: 16, color: '#ef4444' }}>Chat failed to load</div>}>
          <Chat />
        </ErrorBoundary>
      </div>

      {/* Board on the right */}
      <div 
        data-testid="board-container"
        style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <ClientErrorBoundary>
          <WorkingBoard />
        </ClientErrorBoundary>
        {deployCount !== null && (
          <div
            title={`Deployment #${deployCount}`}
            aria-hidden
            style={{
              position: 'absolute',
              right: 8,
              bottom: 8,
              width: 22,
              height: 22,
              borderRadius: 11,
              background: 'rgba(0,0,0,0.05)',
              color: 'rgba(0,0,0,0.5)',
              border: '1px solid rgba(0,0,0,0.08)',
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {deployCount}
          </div>
        )}
      </div>
    </div>
  )
}
