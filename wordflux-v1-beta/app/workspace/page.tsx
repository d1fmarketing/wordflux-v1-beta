'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import dynamicLoad from 'next/dynamic'
import { Skeleton } from '../components/ui/Skeleton'

function BoardSkeleton() {
  const columns = [
    { id: 'skeleton-backlog', title: 'Backlog' },
    { id: 'skeleton-in-progress', title: 'In Progress' },
    { id: 'skeleton-done', title: 'Done' }
  ]
  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="board-skeleton" role="status" aria-live="polite">
      <div className="text-sm text-[var(--ink-500)]">Carregando board…</div>
      <div className="flex flex-wrap gap-4" data-testid="board-grid">
        {columns.map(col => (
          <div
            key={col.id}
            data-testid={`column-${col.id}`}
            className="flex min-w-[180px] max-w-[220px] flex-1 flex-col gap-3 rounded-2xl border border-[rgba(60,62,110,0.32)] bg-[rgba(12,12,32,0.8)] px-4 py-3 text-[var(--ink-700)] shadow-[0_12px_28px_rgba(4,5,23,0.4)]"
          >
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[var(--ink-500)]">
              <span>{col.title}</span>
              <Skeleton className="h-2 w-6" tone="subtle" />
            </div>
            <div className="flex flex-col gap-2 text-[11px] text-[var(--ink-500)]">
              <Skeleton className="h-16 rounded-xl border border-[rgba(90,96,160,0.35)]" tone="surface" />
              <Skeleton className="h-20 rounded-xl border border-[rgba(90,96,160,0.28)]" tone="subtle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const Board2 = dynamicLoad(() => import('../components/board2/Board2'), {
  ssr: false,
  loading: BoardSkeleton
})

function ChatSkeleton() {
  return (
    <div
      className="flex h-full flex-col gap-5 bg-[var(--surface-subtle)] px-5 py-6 text-[var(--ink-500)]"
      data-testid="chat-skeleton"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--success)]">
            <span className="absolute inset-0 animate-ping rounded-full bg-[var(--success)]/50" />
          </span>
          <div className="space-y-1">
            <Skeleton className="h-3 w-32 rounded-full" tone="strong" />
            <Skeleton className="h-2.5 w-44 rounded-full" tone="subtle" />
          </div>
        </div>
        <span className="rounded-full border border-[rgba(255,255,255,0.08)] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[var(--ink-700)]">
          Carregando chat…
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-[rgba(90,96,160,0.24)] bg-[rgba(12,12,32,0.75)] p-5 shadow-[0_18px_32px_rgba(5,5,23,0.32)]">
        <div className="space-y-2">
          <Skeleton className="h-3 w-36 rounded-full" tone="strong" />
          <Skeleton className="h-3 w-48 rounded-full" tone="subtle" />
          <Skeleton className="h-3 w-40 rounded-full" tone="subtle" />
        </div>
        <div className="mt-auto space-y-2">
          <div className="flex gap-2">
            <Skeleton className="h-6 flex-1 rounded-full" tone="surface" />
            <Skeleton className="h-6 w-16 rounded-full" tone="surface" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[rgba(255,255,255,0.2)]">
            Pressione Enter para enviar
          </div>
        </div>
      </div>
    </div>
  )
}

const Chat = dynamicLoad(() => import('../components/Chat'), {
  ssr: false,
  loading: ChatSkeleton
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
    <div
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
      <main
        id="board"
        data-theme="quiet"
        className="flex min-w-0 flex-col overflow-hidden bg-[var(--bg)] lg:col-start-2 lg:row-span-full"
        data-testid="board-container"
      >
        <div className="flex-1 overflow-auto">
          <Board2 />
        </div>
        <ToastHost />
      </main>

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
                  <span className="text-xs text-[var(--ink-500)]">IA pronta para comandar o fluxo</span>
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
    </div>
  )
}
