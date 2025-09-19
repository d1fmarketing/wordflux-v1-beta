'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import dynamicLoad from 'next/dynamic'

const Board2 = dynamicLoad(() => import('../components/board2/Board2'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading board...</div>
})

const Chat = dynamicLoad(() => import('../components/Chat'), {
  ssr: false,
  loading: () => <div style={{ padding: 16 }}>Loading chat...</div>
})

const ToastHost = dynamicLoad(() => import('../components/ToastHost'), {
  ssr: false
})

export default function WorkspacePage() {
  const [mobileChatOpen, setMobileChatOpen] = useState(false)

  useEffect(() => {
    if (!mobileChatOpen) return
    const { style } = document.body
    const previous = style.overflow
    style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileChatOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileChatOpen])

  return (
    <main
      className="
        h-dvh
        grid
        grid-cols-1
        bg-[var(--bg)] text-[var(--ink-900)]
        lg:grid-cols-[clamp(320px,24vw,420px)_1fr]
      "
      data-testid="workspace-grid"
    >
      {/* Chat à esquerda no desktop */}
      <aside
        className="
          hidden lg:flex lg:flex-col
          lg:sticky lg:top-0 lg:h-dvh
          border-r border-[var(--line)]
          bg-[var(--surface-subtle)]
          min-w-[320px] max-w-[480px] overflow-hidden
          lg:col-start-1 lg:row-span-full
        "
        data-testid="chat-panel"
      >
        <div className="flex h-full flex-1 flex-col overflow-hidden min-h-0">
          <Chat />
        </div>
      </aside>

      {/* Board à direita */}
      <div
        className="flex min-w-0 flex-col overflow-hidden bg-[var(--bg)] lg:col-start-2 lg:row-span-full"
        data-testid="board-container"
      >
        <div className="flex-1 overflow-auto">
          <Board2 />
        </div>
        <ToastHost />
      </div>

      <button
        type="button"
        onClick={() => setMobileChatOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-[var(--ink-900)] shadow-[0_18px_38px_rgba(229,12,120,0.45)] transition hover:bg-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] lg:hidden"
        aria-label="Open chat"
      >
        <span className="inline-flex h-2 w-2 items-center justify-center rounded-full bg-[var(--ink-900)] shadow-[0_0_0_4px_rgba(255,249,249,0.26)]" aria-hidden />
        Ask the agent
      </button>

      {mobileChatOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMobileChatOpen(false)
          }}
        >
          <div className="mt-auto w-full rounded-t-3xl border-t border-[var(--line)] bg-[var(--surface-subtle)] shadow-[0_-26px_48px_rgba(5,5,23,0.55)]">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
              <div className="flex items-center gap-3 text-sm text-[var(--ink-700)]">
                <div className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]">
                  <span className="absolute inset-0 animate-ping rounded-full bg-[var(--success)]/50" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[var(--ink-900)]">WordFlux AI</span>
                  <span className="text-xs text-[var(--ink-500)]">Connected to TaskCafe</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="rounded-full border border-transparent px-3 py-1 text-xs text-[var(--ink-500)] transition hover:border-[var(--line)] hover:text-[var(--ink-900)]"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-3 pb-6 pt-3">
              <Chat />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
